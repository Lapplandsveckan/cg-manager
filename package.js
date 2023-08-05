const { exec } = require('child_process');
const fs = require('fs');

function cmd(command, ...args) {
    const nodeModules = `${__dirname}/node_modules/.bin`;
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

async function packageRoutes() {
    const api = `${__dirname}/dist/api`;

    const routes = `${api}/routes`;
    const out = `${api}/_routes.js`;

    const files = fs.readdirSync(routes, { recursive: true })
        .filter((file) => file.endsWith('.js') || file.endsWith('.ts'))
        .map((file) => {
            // First remove the ./ and the .ts, then split by / and remove index
            const fileName = file.substring(0, file.length - '.ts'.length);
            fileName.replace(/\\/g, '/'); // Replace backslashes with forward slashes
            fileName.replace(/(\/|^)index$/, ''); // Remove index at the end, for example: /api/index.ts -> /api


            return `    ['/${fileName}', require('./routes/${file}').default],\n`;
        });

    const content = `[\n${files.join('')}]`;
    fs.writeFileSync(out, `module.exports = ${content};`);
}

async function package() {
    const dist = `${__dirname}/dist/index.js`;
    const out = `${__dirname}/out/gateway`;

    await cmd('tsc');
    await packageRoutes();
    await cmd('pkg', dist, '-t', 'node16', '-o', out);
}

async function clean() {
    const dist = `${__dirname}/dist`;
    if (fs.existsSync(dist)) fs.rmSync(dist, { recursive: true });
}

async function main() {
    await package();
    await clean();

    console.log('Build complete!');
}

main().catch(console.error);