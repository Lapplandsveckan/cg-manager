const { spawnSync } = require('child_process');
const path = require('path');

const repoRoot = path.join(__dirname, '../../../..');
const binaryName = process.platform === 'win32' ? 'cg-sidecar.exe' : 'cg-sidecar';

function buildSidecar({ release = false, required = false } = {}) {
    const profileArgs = release ? ['--release', '--locked'] : [];
    const build = spawnSync(
        'cargo',
        ['build', '-p', 'cg-sidecar', ...profileArgs],
        { cwd: repoRoot, stdio: 'inherit' },
    );

    const cargoMissing = build.error?.code === 'ENOENT';
    if (cargoMissing && !required) {
        console.warn('cargo not found, skipping the sidecar build (install Rust from https://rustup.rs to enable it)');
        return null;
    }

    if (build.error) throw build.error;
    if (build.status !== 0) throw new Error(`cargo build failed with code ${build.status}`);

    const profile = release ? 'release' : 'debug';
    return path.join(repoRoot, 'target', profile, binaryName);
}

module.exports = { buildSidecar, binaryName };

if (require.main === module) buildSidecar({ release: process.argv.includes('--release') });
