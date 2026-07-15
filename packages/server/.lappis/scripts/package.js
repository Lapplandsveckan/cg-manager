const { exec } = require('child_process');
const fss = require('fs');
const fs = fss.promises;
const path = require('path');
const root = path.join(__dirname, '../../');
// Yarn workspaces hoist deps to the monorepo-root node_modules — `root` here
// is `packages/server`, so binaries/patched files live two levels further up.
const modulesRoot = path.join(root, '..', '..', 'node_modules');

function cmd(command, ...args) {
    let cmdPath = JSON.stringify(path.join(modulesRoot, command));
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

    const files = (await readDirRecursive(routes)).map(file => {
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

    const _files = await fs
        .readdir(internals)
        .catch(e => (e.code === 'ENOENT' ? [] : e));

    if (_files instanceof Error) throw _files;

    const files = _files
        .filter(file => !file.includes('.'))
        .map(
            file =>
                `    { plugin: require('./internal/${file}').default, dir: __dirname + '/internal/${file}' },\n`,
        );

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

    await cmd(
        path.join('next', 'dist', 'bin', 'next'),
        'build',
        JSON.stringify(web),
    );
    await fs.rename(path.join(web, '.next'), out);

    // Co-locate Next config files alongside the built app so that
    // next({ dir: __dirname }) resolves them correctly inside the pkg snapshot
    // (where __dirname = /snapshot/manager/dist/web).
    const distWeb = path.join(root, 'dist', 'web');
    await fs.copyFile(
        path.join(web, 'next.config.js'),
        path.join(distWeb, 'next.config.js'),
    );
    await fs.copyFile(
        path.join(web, 'next-i18next.config.js'),
        path.join(distWeb, 'next-i18next.config.js'),
    );
}

// List top-level package names directly under a node_modules dir (one level
// into @scope/ dirs). Used both to read the Next `standalone` trace output
// and to size-report against the full hoisted node_modules.
async function listTopLevelPackages(nodeModulesDir) {
    const names = new Set();
    const entries = await fs
        .readdir(nodeModulesDir, { withFileTypes: true })
        .catch(e => (e.code === 'ENOENT' ? [] : Promise.reject(e)));

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name === '.bin') continue;

        if (entry.name.startsWith('@')) {
            const scoped = await fs.readdir(
                path.join(nodeModulesDir, entry.name),
                { withFileTypes: true },
            );
            for (const sub of scoped) {
                if (sub.isDirectory()) names.add(`${entry.name}/${sub.name}`);
            }
            continue;
        }

        names.add(entry.name);
    }

    return names;
}

// Trace the require()/import (incl. require.resolve) graph reachable from
// `entryFile` with @vercel/nft — the same tracer Next uses for its own
// `output: 'standalone'` — and return the set of node_modules package names
// it touches. nft ships bundled inside `next`, so this needs no new dependency.
async function traceServerClosure(entryFile, repoRoot) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { nodeFileTrace } = require(
        path.join(modulesRoot, 'next', 'dist', 'compiled', '@vercel', 'nft'),
    );
    const { fileList } = await nodeFileTrace([entryFile], { base: repoRoot });

    const names = new Set();
    for (const file of fileList) {
        const match = file.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/);
        if (match) names.add(match[1]);
    }

    return names;
}

// Packages the runtime plugin-UI webpack/babel bundler
// (src/manager/plugins/ui.ts) reaches only via `require.resolve()` string
// literals inside a dynamically-loaded babel plugin graph. nft traces these
// too (verified against dist/index.js), but they're forced in regardless as
// a safety net since a missing one only fails at plugin-bundle time, not boot.
const FORCE_INCLUDE_PACKAGES = [
    'webpack',
    'babel-loader',
    'memory-fs',
    '@babel/core',
    '@babel/preset-env',
    '@babel/preset-react',
    '@babel/preset-typescript',
    'react-i18next',
    'next-i18next',
    'i18next',
    'html-parse-stringify',
    'void-elements',
];

// Compute the set of root node_modules packages actually reachable at
// runtime, instead of shipping the whole hoisted node_modules tree:
//   - the Next `output: 'standalone'` trace (dist/web/.next/standalone/node_modules)
//     covers everything Next's SSR needs (@mui/*, @emotion/*, react-dom, ...).
//   - an nft trace of the compiled server entrypoint covers the rest (express,
//     werift, xml2js, the runtime webpack/babel plugin-UI bundler, ...).
// NOTE: only the *names* out of the standalone trace are used here. The
// `dist/web/.next/standalone/` directory itself is never read at runtime —
// `startWeb()` (src/web/index.ts) calls `next({ dir: __dirname })` with
// `__dirname` = `dist/web` (the plain build output), so Next's own
// `require()`s resolve via normal Node module resolution against the
// *hoisted* `../../node_modules/<pkg>` assets below, not the standalone
// copy. Shipping `standalone/` too would duplicate every SSR package
// (next, react-dom, @mui/*, webpack, core-js, ...) for nothing — see
// `removeStandaloneOutput()`, called right after this in `package()`.
async function computeAssetClosure() {
    console.log('Computing node_modules dependency closure...');

    const repoRoot = path.join(root, '..', '..');
    const standaloneModules = path.join(
        root,
        'dist',
        'web',
        '.next',
        'standalone',
        'node_modules',
    );

    if (!fss.existsSync(standaloneModules)) {
        throw new Error(
            `Next standalone trace missing at ${standaloneModules} — did next build emit output: 'standalone'?`,
        );
    }

    const [ssrPackages, serverPackages, allInstalled] = await Promise.all([
        listTopLevelPackages(standaloneModules),
        traceServerClosure(path.join(root, 'dist', 'index.js'), repoRoot),
        listTopLevelPackages(modulesRoot),
    ]);

    const closure = new Set([
        ...ssrPackages,
        ...serverPackages,
        ...FORCE_INCLUDE_PACKAGES,
    ]);

    console.log(
        `Dependency closure: ${closure.size} of ${allInstalled.size} installed packages.`,
    );

    return [...closure].sort().map(name => `../../node_modules/${name}/**/*`);
}

// Delete build-time-only output from `dist/web/.next/` before the
// `dist/web/.next/**/*` asset glob sweeps it into the pkg snapshot:
//   - `standalone/` — a full duplicate copy of every SSR package (next,
//     react-dom, @mui/*, webpack, core-js, ...), never read at runtime (see
//     the note above computeAssetClosure). Only its package-name listing is
//     used, and that's already read by the time this runs.
//   - `cache/` — Next's own incremental-build cache (webpack/swc caches),
//     irrelevant once the build is done.
async function removeStandaloneOutput() {
    const dotNext = path.join(root, 'dist', 'web', '.next');
    await Promise.all([
        fs.rm(path.join(dotNext, 'standalone'), {
            recursive: true,
            force: true,
        }),
        fs.rm(path.join(dotNext, 'cache'), { recursive: true, force: true }),
    ]);
}

// Write a standalone pkg config (rather than package.json's `pkg` field) so
// the computed asset closure can be regenerated fresh on every build. Written
// alongside package.json so its relative asset globs (`../../node_modules/...`,
// `dist/web/...`) resolve exactly like the previous inline `pkg` field did —
// pkg resolves config-relative globs against the config file's own directory.
async function writePkgConfig(assetClosureGlobs) {
    const pkgJson = JSON.parse(
        await fs.readFile(path.join(root, 'package.json'), 'utf-8'),
    );
    const base = pkgJson.pkg;

    const targets = process.env.PACKAGE_TARGETS
        ? process.env.PACKAGE_TARGETS.split(',')
              .map(t => t.trim())
              .filter(Boolean)
        : base.targets;

    const config = {
        options: base.options,
        scripts: base.scripts,
        assets: [
            'dist/web/.next/**/*',
            'dist/web/public/**/*',
            'dist/plugins/internal/**/ui/*.jsx',
            ...assetClosureGlobs,
        ],
        targets,
        outputPath: base.outputPath,
    };

    const configPath = path.join(root, 'pkg.generated.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 4));
    return configPath;
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
        throw new Error(
            `${label} patch did not apply — upstream source changed`,
        );
    }
    await fs.writeFile(filePath, src.replace(from, to));
}

async function patchVmCallSites() {
    console.log('Patching vm call sites...');
    const loader = "require('vm').constants.USE_MAIN_CONTEXT_DEFAULT_LOADER";
    const webpackFile = path.join(
        modulesRoot,
        'webpack',
        'lib',
        'javascript',
        'JavascriptModulesPlugin.js',
    );

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
        path.join(
            modulesRoot,
            'next',
            'dist',
            'server',
            'load-manifest.external.js',
        ),
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
        path.join(modulesRoot, 'next', 'dist', 'server', 'config.js'),
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
        path.join(modulesRoot, 'babel-loader', 'lib', 'cache.js'),
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

    const assetClosureGlobs = await computeAssetClosure();
    await removeStandaloneOutput();
    const configPath = await writePkgConfig(assetClosureGlobs);

    await patchVmCallSites();

    console.log('Packaging executable...');
    // Force the base output name to "manager" regardless of the workspace
    // package name. With a single target this is the exact output filename;
    // with multiple targets (PACKAGE_TARGETS) pkg appends a per-target suffix
    // (e.g. "manager-linux-x64", "manager-macos-arm64") automatically.
    const output = path.join(root, 'out', 'manager');

    // Entry is the compiled server file directly (not package.json) so that
    // `--config` can supply the computed `pkg` config — pkg refuses to accept
    // both a package.json entry (which has its own `pkg` field) and --config.
    await cmd(
        path.join('@yao-pkg', 'pkg', 'lib-es5', 'bin.js'),
        JSON.stringify(path.join(root, 'dist', 'index.js')),
        '--config',
        JSON.stringify(configPath),
        '--output',
        JSON.stringify(output),
        '--compress',
        'Brotli',
    );

    await fs.rm(configPath, { force: true });
}

// Find every executable pkg produced in out/. Single-target builds (the
// default, CI included) produce exactly "manager" (or "manager.exe"); a
// PACKAGE_TARGETS override with multiple targets produces one file per
// target, each suffixed with whichever axes differ (e.g. "manager-linux-x64",
// "manager-macos-arm64").
async function findBuiltExecutables() {
    const outDir = path.join(root, 'out');
    const entries = await fs
        .readdir(outDir)
        .catch(e => (e.code === 'ENOENT' ? [] : Promise.reject(e)));

    return entries
        .filter(
            name =>
                name === 'manager' ||
                name.startsWith('manager-') ||
                name === 'manager.exe',
        )
        .map(name => path.join(outDir, name));
}

async function moveExecutable() {
    let dest = process.env.DEST;
    if (!dest) return;

    console.log('Moving executable...');

    const built = await findBuiltExecutables();
    if (built.length === 0)
        throw new Error('No packaged executable found in out/');

    if (built.length > 1) {
        if (!dest.endsWith('/') && !dest.endsWith('\\')) {
            throw new Error(
                'DEST must be a directory (trailing slash) when packaging multiple targets',
            );
        }

        for (const file of built)
            await fs.copyFile(file, path.join(dest, path.basename(file)));
        console.log(`Executables moved to ${dest}`);
        return;
    }

    let target = dest;
    if (target.endsWith('/') || target.endsWith('\\'))
        target += path.basename(built[0]);

    await fs.copyFile(built[0], target);
    console.log(`Executable moved to ${target}`);
}

async function finalize(state) {
    if (!state) {
        console.log('Skipping finalize — build failed.');
        return;
    }

    console.log('Finalizing...');
    await moveExecutable();
}

async function clean() {
    console.log('Cleaning up...');

    const dist = `${root}/dist`;
    await fs.rm(dist, { recursive: true });
    await fs.rm(path.join(root, 'pkg.generated.json'), { force: true });
}

async function main() {
    let state = true;
    await package().catch(e => (state = false) || console.error(e));
    await finalize(state);
    await clean();

    if (state) console.log('Build complete!');
    else console.error('Build failed!');

    if (!state) process.exit(1);
}

main().catch(console.error);
