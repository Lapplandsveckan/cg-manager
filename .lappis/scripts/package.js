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
            const fileName = file.substring(0, file.length - '.js'.length);
            fileName.replace(/\\/g, '/'); // Replace backslashes with forward slashes
            fileName.replace(/(\/|^)index$/, ''); // Remove index at the end, for example: /api/index.ts -> /api


            return `    ['/${fileName}', require('./routes/${file}').default],\n`;
        });

    const content = `[\n${files.join('')}]`;
    await fs.writeFile(out, `module.exports = ${content};`);
}

async function packageConfig() {
    console.log('Packaging config...');

    const out = path.join(root, 'dist', 'util', '_config.js');
    const config = path.join(root, 'config.json');

    const content = await fs.readFile(config, 'utf-8');
    await fs.writeFile(out, `module.exports = ${content};`);
}

async function packageWeb() {
    console.log('Packaging web...');

    const web = path.join(root, 'src', 'web');
    const out = path.join(root, 'dist', 'web', '.next');

    await cmd(path.join('next', 'dist', 'bin', 'next'), 'build', JSON.stringify(web));
    await fs.rename(path.join(web, '.next'), out);
}

async function package() {
    let outName = 'gateway';
    if (process.platform === 'win32') outName += '.exe';

    const dist = JSON.stringify(path.join(root, 'dist', 'index.js'));
    const out = JSON.stringify(path.join(root, 'out', outName));

    console.log('Compiling TypeScript...');
    await cmd(path.join('typescript', 'bin', 'tsc'));

    await packageRoutes();
    await packageConfig();
    await packageWeb();

    console.log('Packaging executable...');
    await cmd(path.join('pkg', 'lib-es5', 'bin.js'), JSON.stringify(path.join(root, 'package.json')));
}

async function clean() {
    console.log('Cleaning up...');

    const dist = `${root}/dist`;
    await fs.rm(dist, { recursive: true });
}

async function main() {
    let state = true;
    await package().catch((e) => (state = false) || console.error(e));
    await clean();

    if (state) console.log('Build complete!');
    else console.error('Build failed!');
}

main().catch(console.error);