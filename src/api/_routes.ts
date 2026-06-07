// This script loads all the routes from the routes folder and exports them as a single array.
// This script is replaced by a static require statement in the compiled code.

import path from 'path';
import fs from 'fs';
import { type RouteExport } from './route';

function readDirRecursive(dir: string) {
    const results = fs.readdirSync(dir);
    const files = [];

    for (const result of results) {
        if (result.endsWith('.js')) files.push(result);
        if (result.endsWith('.ts')) files.push(result);
        if (result.includes('.')) continue;

        const subFiles = readDirRecursive(path.join(dir, result));
        for (const subFile of subFiles) files.push(`${result}/${subFile}`);
    }

    return files;
}

const files = readDirRecursive(path.join(__dirname, 'routes')).map(file => {
    let fileName = file.substring(0, file.length - '.js'.length);
    fileName = fileName.replace(/(\/|^)index$/, '');

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const routeExport = require(`./routes/${file}`).default;
    return [`/${fileName}`, routeExport] as [string, RouteExport];
});

export default files;
