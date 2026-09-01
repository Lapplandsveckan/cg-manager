const { exec } = require('child_process');
const fs = require('fs/promises');
const path = require('path');

const root = path.join(__dirname, '../../');
// Yarn workspaces hoist deps to the monorepo-root node_modules — `root` here
// is `packages/server`, so binaries live two levels further up.
const modulesRoot = path.join(root, '..', '..', 'node_modules');
const webLibDir = path.join(root, '..', 'core', 'web-lib');
const generatedDir = path.join(webLibDir, 'generated');

function cmd(command, ...args) {
    let cmdPath = JSON.stringify(path.join(modulesRoot, command));
    cmdPath += args.map(arg => ` ${arg}`).join('');

    return new Promise((resolve, reject) => {
        exec(`node ${cmdPath}`, { cwd: root }, (error, stdout, stderr) => {
            if (error) {
                console.error(stderr || stdout);
                reject(error);
                return;
            }

            resolve(stdout ? stdout : stderr);
        });
    });
}

// packages/core/web-lib/index.d.ts (hand-written) re-exports from here.
// Regenerated wholesale on every run so stale entries never linger.
async function emitDeclarations() {
    console.log('Emitting @web-lib declarations...');
    await fs.rm(generatedDir, { recursive: true, force: true });
    await cmd('.bin/tsc', '-p', 'tsconfig.web-lib.json');
}

async function formatOutput() {
    console.log('Formatting @web-lib declarations...');
    const pattern = path.join(webLibDir, '**', '*.d.ts');
    await cmd('.bin/prettier', '--write', JSON.stringify(pattern));
}

async function main() {
    await emitDeclarations();
    await formatOutput();
    console.log('@web-lib declarations up to date.');
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
