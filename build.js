const { exec } = require("child_process");

function cmd(command, ...args) {
    const nodeModules = __dirname + '/node_modules/.bin';
    return new Promise((resolve, reject) => {
        exec(`node ${nodeModules}/${command} ${args.join(' ')}`, (error, stdout, stderr) => {
            if (error) {
                console.error(error);
                reject(error);
                return;
            }

            resolve(stdout ? stdout : stderr);
        });
    });
}

async function build() {
    const dist = __dirname + '/dist/index.js';
    const out = __dirname + '/out/gateway';

    await cmd('tsc');
    await cmd('pkg', dist, '-t', 'node16', '-o', out);
}

async function clean() {
    const fs = require('fs');
    const dist = __dirname + '/dist';

    if (fs.existsSync(dist)) fs.rmSync(dist, { recursive: true });
}

async function main() {
    await build();
    await clean();

    console.log('Build complete!');
}

main().catch(console.error);