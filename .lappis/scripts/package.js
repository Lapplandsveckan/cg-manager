const { exec } = require('child_process');
const fss = require('fs');
const fs = fss.promises;
const path = require('path');
const root = path.join(__dirname, '../../');

function cmd(command, ...args) {
    let cmdPath = JSON.stringify(path.join(root, 'node_modules', command));
    cmdPath += args.map(arg => ` ${arg}`).join('');

    return new Promise((resolve, reject) => {
        exec(`node ${cmdPath}`, (error, stdout, stderr) => {
            if (error) {
                console.error(error);
                reject(error);
                return;
            }

            resolve(stdout ? stdout : stderr);
        });
    });
}

async function readDirRecursive(dir) {
    const results = await fs.readdir(dir);
    const files = [];

    for (const result of results) {
        if (result.endsWith('.js')) files.push(result);
        if (result.includes('.')) continue;

        const subFiles = await readDirRecursive(path.join(dir, result));
        for (const subFile of subFiles) files.push(`${result}/${subFile}`);
    }

    return files;
}

async function packageRoutes() {
    console.log('Packaging routes...');
    const api = path.join(root, 'dist', 'api');

    const routes = path.join(api, 'routes');
    const out = path.join(api, '_routes.js');

    const files = (await readDirRecursive(routes))
        .map((file) => {
            // First remove the ./ and the .ts, then split by / and remove index
            let fileName = file.substring(0, file.length - '.js'.length);
            fileName = fileName.replace(/(\/|^)index$/, ''); // Remove index at the end, for example: /api/index.ts -> /api

            return `    ['/${fileName}', require('./routes/${file}').default],\n`;
        });

    const content = `[\n${files.join('')}]`;
    await fs.writeFile(out, `module.exports = ${content};`);
}

async function packageInternalPlugins() {
    console.log('Packaging internal plugins...');
    const plugins = path.join(root, 'dist', 'plugins');

    const internals = path.join(plugins, 'internal');
    const out = path.join(plugins, '_plugins.js');

    const _files = await fs.readdir(internals)
        .catch(e => e.code === 'ENOENT' ? [] : e);

    if (_files instanceof Error) throw _files;

    const files = _files
        .filter((file) => !file.includes('.'))
        .map((file) => `    { plugin: require('./internal/${file}').default, dir: __dirname + '/internal/${file}' },\n`);

    const content = `[\n${files.join('')}]`;
    await fs.writeFile(out, `module.exports = ${content};`);
}

async function packageConfig() {
    console.log('Packaging config...');

    const out = path.join(root, 'dist', 'util', '_config.js');
    const config = path.join(root, 'config.prod.json');

    const content = await fs.readFile(config, 'utf-8');
    await fs.writeFile(out, `module.exports = ${content};`);
}

async function packageWeb() {
    console.log('Packaging web...');

    const web = path.join(root, 'src', 'web');
    const out = path.join(root, 'dist', 'web', '.next');

    await cmd(path.join('next', 'dist', 'bin', 'next'), 'build', JSON.stringify(web));
    await fs.rename(path.join(web, '.next'), out);

    // Co-locate Next config files alongside the built app so that
    // next({ dir: __dirname }) resolves them correctly inside the pkg snapshot
    // (where __dirname = /snapshot/manager/dist/web).
    const distWeb = path.join(root, 'dist', 'web');
    await fs.copyFile(path.join(web, 'next.config.js'), path.join(distWeb, 'next.config.js'));
    await fs.copyFile(path.join(web, 'next-i18next.config.js'), path.join(distWeb, 'next-i18next.config.js'));
}

// Patch vm call sites in node_modules that omit importModuleDynamically.
// Inside a pkg snapshot, vm code that calls import() throws
// ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING unless the option is set.
// USE_MAIN_CONTEXT_DEFAULT_LOADER works without --experimental-vm-modules
// on Node ≥20.12 / 22.
async function patchVmCallSites() {
    console.log('Patching vm call sites...');
    const loader = "require('vm').constants.USE_MAIN_CONTEXT_DEFAULT_LOADER";

    // webpack's JavascriptModulesPlugin uses vm.runInThisContext for executeModule.
    const webpackFile = path.join(root, 'node_modules', 'webpack', 'lib', 'javascript', 'JavascriptModulesPlugin.js');
    let src = await fs.readFile(webpackFile, 'utf-8');

    const src1 = src.replace(
        '\t\t\t\t\t\t\tfilename: module.identifier(),\n\t\t\t\t\t\t\tlineOffset: -1\n\t\t\t\t\t\t}',
        `\t\t\t\t\t\t\tfilename: module.identifier(),\n\t\t\t\t\t\t\tlineOffset: -1,\n\t\t\t\t\t\t\timportModuleDynamically: ${loader}\n\t\t\t\t\t\t}`,
    );
    if (src1 === src) throw new Error('webpack vm patch 1 did not apply — upstream source changed');
    const src2 = src1.replace(
        '\t\t\t\t\t\t\tfilename: options.module.identifier(),\n\t\t\t\t\t\t\tlineOffset: -1\n\t\t\t\t\t\t}',
        `\t\t\t\t\t\t\tfilename: options.module.identifier(),\n\t\t\t\t\t\t\tlineOffset: -1,\n\t\t\t\t\t\t\timportModuleDynamically: ${loader}\n\t\t\t\t\t\t}`,
    );
    if (src2 === src1) throw new Error('webpack vm patch 2 did not apply — upstream source changed');
    await fs.writeFile(webpackFile, src2);

    // Next.js's load-manifest uses vm.runInNewContext for app-router manifests.
    const nextManifestFile = path.join(root, 'node_modules', 'next', 'dist', 'server', 'load-manifest.external.js');
    let nextSrc = await fs.readFile(nextManifestFile, 'utf-8');
    const nextSrc1 = nextSrc.replace(
        '(0, _vm.runInNewContext)(content, contextObject);',
        `(0, _vm.runInNewContext)(content, contextObject, { importModuleDynamically: _vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER });`,
    );
    if (nextSrc1 === nextSrc) throw new Error('next.js vm patch did not apply — upstream source changed');
    await fs.writeFile(nextManifestFile, nextSrc1);

    // babel-loader/lib/cache.js has a top-level `import("find-cache-dir")` (an
    // ESM-only package). pkg's bootstrap Module._compile has no
    // importModuleDynamically callback, so this throws at module load time before
    // our vm-patch can intercept it. Replace it with a Promise that returns null
    // so the cache falls back to os.tmpdir() — harmless since cacheDirectory is
    // not set in our webpack config and the cache function is never actually called.
    const babelCacheFile = path.join(root, 'node_modules', 'babel-loader', 'lib', 'cache.js');
    let babelSrc = await fs.readFile(babelCacheFile, 'utf-8');
    const babelSrc1 = babelSrc.replace(
        'const findCacheDirP = import("find-cache-dir");',
        'const findCacheDirP = Promise.resolve({ default: () => null }); // find-cache-dir is ESM-only; fall back to os.tmpdir()',
    );
    if (babelSrc1 === babelSrc) throw new Error('babel-loader cache.js patch did not apply — upstream source changed');
    await fs.writeFile(babelCacheFile, babelSrc1);
}

async function package() {
    console.log('Compiling TypeScript...');
    await cmd(path.join('typescript', 'bin', 'tsc'));

    await packageRoutes();
    await packageInternalPlugins();
    await packageConfig();
    await packageWeb();
    await patchVmCallSites();

    console.log('Packaging executable...');
    await cmd(path.join('@yao-pkg', 'pkg', 'lib-es5', 'bin.js'), JSON.stringify(path.join(root, 'package.json')));
}

async function moveExecutable() {
    let dest = process.env.DEST;
    if (!dest) return;

    console.log('Moving executable...');

    let ending = 'manager';
    if (process.platform === 'win32') ending += '.exe';

    if (dest.endsWith('/') || dest.endsWith('\\')) dest += ending;

    const src = path.join(root, 'out', ending);
    await fs.copyFile(src, dest);

    console.log(`Executable moved to ${dest}`);
}

async function finalize() {
    console.log('Finalizing...');
    await moveExecutable();
}

async function clean() {
    console.log('Cleaning up...');

    const dist = `${root}/dist`;
    await fs.rm(dist, { recursive: true });
}

async function main() {
    let state = true;
    await package().catch((e) => (state = false) || console.error(e));
    await finalize();
    await clean();

    if (state) console.log('Build complete!');
    else console.error('Build failed!');
    
    if (!state) process.exit(1);
}

main().catch(console.error);