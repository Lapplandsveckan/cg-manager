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
// Apply a string patch to a file. Idempotent: if `from` is not found but `to`
// is already present, the patch is considered already applied (skip).
// Throws if neither is found (upstream source changed unexpectedly).
async function applyPatch(filePath, from, to, label) {
    const src = await fs.readFile(filePath, 'utf-8');
    if (!src.includes(from)) {
        if (src.includes(to)) return; // already applied from a prior run
        throw new Error(`${label} patch did not apply — upstream source changed`);
    }
    await fs.writeFile(filePath, src.replace(from, to));
}

async function patchVmCallSites() {
    console.log('Patching vm call sites...');
    const loader = "require('vm').constants.USE_MAIN_CONTEXT_DEFAULT_LOADER";
    const webpackFile = path.join(root, 'node_modules', 'webpack', 'lib', 'javascript', 'JavascriptModulesPlugin.js');

    // webpack's JavascriptModulesPlugin uses vm.runInThisContext for executeModule.
    await applyPatch(
        webpackFile,
        '\t\t\t\t\t\t\tfilename: module.identifier(),\n\t\t\t\t\t\t\tlineOffset: -1\n\t\t\t\t\t\t}',
        `\t\t\t\t\t\t\tfilename: module.identifier(),\n\t\t\t\t\t\t\tlineOffset: -1,\n\t\t\t\t\t\t\timportModuleDynamically: ${loader}\n\t\t\t\t\t\t}`,
        'webpack vm patch 1',
    );
    await applyPatch(
        webpackFile,
        '\t\t\t\t\t\t\tfilename: options.module.identifier(),\n\t\t\t\t\t\t\tlineOffset: -1\n\t\t\t\t\t\t}',
        `\t\t\t\t\t\t\tfilename: options.module.identifier(),\n\t\t\t\t\t\t\tlineOffset: -1,\n\t\t\t\t\t\t\timportModuleDynamically: ${loader}\n\t\t\t\t\t\t}`,
        'webpack vm patch 2',
    );

    // Next.js's load-manifest uses vm.runInNewContext for app-router manifests.
    await applyPatch(
        path.join(root, 'node_modules', 'next', 'dist', 'server', 'load-manifest.external.js'),
        '(0, _vm.runInNewContext)(content, contextObject);',
        '(0, _vm.runInNewContext)(content, contextObject, { importModuleDynamically: _vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER });',
        'next.js vm patch',
    );

    // Next's loadConfig() loads next.config.js via `await import(pathToFileURL)`.
    // In custom-server mode the router-server worker re-runs loadConfig from disk
    // (ignoring the `conf` we pass), and that ESM import() of a snapshot path
    // throws ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING. Our config is CJS and is
    // embedded as a pkg script, so fall back to require() — the same fix Next
    // already applies for jest (see the comment just above the patched line).
    await applyPatch(
        path.join(root, 'node_modules', 'next', 'dist', 'server', 'config.js'),
        'userConfigModule = await import((0, _url.pathToFileURL)(path).href);',
        'userConfigModule = require(path); // pkg: ESM import() of snapshot path fails; config is CJS',
        'next.js config.js loadConfig',
    );

    // babel-loader/lib/cache.js has a top-level `import("find-cache-dir")` (an
    // ESM-only package). pkg's bootstrap Module._compile has no
    // importModuleDynamically callback, so this throws at module load time before
    // our vm-patch can intercept it. Replace it with a Promise that returns null
    // so the cache falls back to os.tmpdir() — harmless since cacheDirectory is
    // not set in our webpack config and the cache function is never actually called.
    await applyPatch(
        path.join(root, 'node_modules', 'babel-loader', 'lib', 'cache.js'),
        'const findCacheDirP = import("find-cache-dir");',
        'const findCacheDirP = Promise.resolve({ default: () => null }); // find-cache-dir is ESM-only; fall back to os.tmpdir()',
        'babel-loader cache.js',
    );
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