const { exec } = require('child_process');
const fs = require('fs');
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

async function packageRoutes() {
    const api = path.join(root, 'dist', 'api');

    const routes = path.join(api, 'routes');
    const out = path.join(api, '_routes.js');

    const files = fs.readdirSync(routes, { recursive: true })
        .filter((file) => file.endsWith('.js'))
        .map((file) => {
            // First remove the ./ and the .ts, then split by / and remove index
            const fileName = file.substring(0, file.length - '.js'.length);
            fileName.replace(/\\/g, '/'); // Replace backslashes with forward slashes
            fileName.replace(/(\/|^)index$/, ''); // Remove index at the end, for example: /api/index.ts -> /api


            return `    ['/${fileName}', require('./routes/${file}').default],\n`;
        });

    const content = `[\n${files.join('')}]`;
    fs.writeFileSync(out, `module.exports = ${content};`);
}

async function package() {
    let outName = 'gateway';
    if (process.platform === 'win32') outName += '.exe';

    const dist = JSON.stringify(path.join(root, 'dist', 'index.js'));
    const out = JSON.stringify(path.join(root, 'out', outName));

    await cmd(path.join('typescript', 'bin', 'tsc'));
    await packageRoutes();
    await cmd(path.join('pkg', 'lib-es5', 'bin.js'), dist, '-t', 'node16', '-o', out);
}

async function clean() {
    const dist = `${root}/dist`;
    if (fs.existsSync(dist)) fs.rmSync(dist, { recursive: true });
}

async function main() {
    await package();
    await clean();

    console.log('Build complete!');
}

main().catch(console.error);