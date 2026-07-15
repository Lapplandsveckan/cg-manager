'use strict';

const { exec, execFile } = require('child_process');
const fss = require('fs');
const fs = fss.promises;
const path = require('path');
const archiver = require('archiver');

const MAX_BUFFER = 1024 * 1024 * 64;

function handle(resolve, reject) {
    return (error, stdout, stderr) => {
        if (error) {
            console.error(stdout);
            console.error(stderr);
            reject(error);
            return;
        }

        resolve(stdout ? stdout : stderr);
    };
}

// Shell-interpreted; for user-provided step strings only.
function sh(root, command) {
    return new Promise((resolve, reject) => {
        exec(command, { cwd: root, maxBuffer: MAX_BUFFER }, handle(resolve, reject));
    });
}

// argv-based, no shell — paths with spaces/special chars are passed verbatim.
function node(root, command, ...args) {
    const bin = path.join(root, 'node_modules', command);
    return new Promise((resolve, reject) => {
        execFile('node', [bin, ...args], { cwd: root, maxBuffer: MAX_BUFFER }, handle(resolve, reject));
    });
}

async function packageSource(ctx) {
    const { root } = ctx;
    console.log('Compiling plugin source...');
    await node(root, path.join('webpack-cli', 'bin', 'cli'));
    await fs.rm(path.join(root, 'dist', 'index.js.LICENSE.txt')).catch(() => null);
    await fs.cp(path.join(root, 'package.json'), path.join(root, 'dist', 'package.json'));
    // Full node_modules copy — externals need their deps at runtime.
    // TODO: prune to transitive closure of pkg.dependencies once a safe walk is validated.
    await fs.cp(path.join(root, 'node_modules'), path.join(root, 'dist', 'node_modules'), { recursive: true });
}

async function packageUI(ctx) {
    const { root, ui } = ctx;
    const uiDir = path.join(root, ui);
    const exists = await fs.access(uiDir).then(() => true).catch(() => false);
    if (!exists) return;

    console.log('Packaging UI...');
    await fs.cp(uiDir, path.join(root, 'dist', 'ui'), { recursive: true });
}

async function runSteps(ctx) {
    const { root, steps } = ctx;
    if (!steps || !steps.length) return;

    for (const step of steps) {
        if (typeof step === 'function') {
            await step(ctx);
            continue;
        }

        const { name, run } = typeof step === 'string' ? { name: step, run: step } : step;
        console.log(`Running step: ${name}...`);
        await sh(root, run);
    }
}

async function assemble(ctx) {
    const { root, out } = ctx;
    const dest = path.join(root, out);

    console.log('Packaging plugin...');
    // Consumes dist — must run before archive/movePlugin.
    await fs.rm(dest, { recursive: true }).catch(() => null);
    await fs.rename(path.join(root, 'dist'), dest);
}

function archive(ctx) {
    const { root, out, name } = ctx;
    const src = path.join(root, out);
    const dest = path.join(root, `${name}.cgplugin`);

    console.log('Archiving plugin...');
    return new Promise((resolve, reject) => {
        const output = fss.createWriteStream(dest);
        const zip = archiver('zip');

        output.on('close', resolve);
        output.on('error', reject);
        zip.on('error', reject);

        zip.pipe(output);
        zip.directory(src, false);
        zip.finalize().catch(reject);
    });
}

async function movePlugin(ctx) {
    const { root, out, dest } = ctx;
    if (!dest) return;

    console.log('Moving plugin...');

    // dest is always the parent plugins directory; we only ever touch dest/out.
    const target = path.join(path.resolve(root, dest), out);
    const src = path.join(root, out);
    await fs.rm(target, { recursive: true }).catch(() => null);
    await fs.cp(src, target, { recursive: true });

    console.log(`Plugin installed to ${target}`);
}

// Leave only the archive at root; the assembled dir lives at dest (if any).
async function cleanup(ctx) {
    const { root, out } = ctx;
    await fs.rm(path.join(root, out), { recursive: true }).catch(() => null);
}

async function build(options = {}) {
    const root = options.root || process.cwd();
    const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
    const cfg = pkg.cgplugin || {};

    const name = options.name || (pkg.name || '').replace(/^@[^/]+\//, '').replace(/[^a-z0-9_-]/gi, '-') || 'plugin';
    const out = options.out || cfg.out || name;
    const ui = options.ui || cfg.ui || 'ui';
    const steps = options.steps !== undefined ? options.steps : (cfg.steps || []);
    const dest = options.dest || cfg.dest || process.env.DEST || null;

    const ctx = { root, name, out, ui, steps, dest };

    const pipeline = [packageSource, packageUI, runSteps, assemble, archive, movePlugin, cleanup];
    for (const step of pipeline) {
        const failed = await step(ctx).then(() => false).catch(e => (console.error(e), true));
        if (failed) {
            console.error('Build failed!');
            return false;
        }
    }

    console.log('Build complete!');
    return true;
}

module.exports = { build, packageSource, packageUI, runSteps, assemble, archive, movePlugin, cleanup };
