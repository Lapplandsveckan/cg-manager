// This script loads all the routes from the routes folder and exports them as a single array.
// This script is replaced by a static require statement in the compiled code.

import path from 'path';
import {RouteExport} from './route';
import fs from 'fs';

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

const files = readDirRecursive(path.join(__dirname, 'routes'))
    .map((file) => {
        // First remove the ./ and the .ts, then split by / and remove index
        const fileName = file.substring(0, file.length - '.js'.length);
        fileName.replace(/\\/g, '/'); // Replace backslashes with forward slashes
        fileName.replace(/(\/|^)index$/, ''); // Remove index at the end, for example: /api/index.ts -> /api

        const routeExport = require(`./routes/${file}`).default;

        return [`/${fileName}`, routeExport] as [string, RouteExport];
    });

export default files;