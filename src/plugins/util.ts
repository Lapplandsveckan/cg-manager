import fs from 'fs';
import path from 'path';
import {CasparPlugin} from '../manager/amcp/plugin';

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

export function loadPluginFolder(dir: string) {
    return readDirRecursive(dir)
        .map((file) => require(path.join(dir, file)).default as typeof CasparPlugin);
}