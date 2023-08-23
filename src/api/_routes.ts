// This script loads all the routes from the routes folder and exports them as a single array.
// This script is replaced by a static require statement in the compiled code.

import path from 'path';
import { sync } from 'glob';
import {RouteExport} from './route';

const files = sync(path.join(__dirname, './routes/**/*'))
    .filter((file) => file.endsWith('.js') || file.endsWith('.ts'))
    .map((file) => {
        const routeExport = require(file).default as RouteExport;
        const prefix = `${__dirname}/routes`;

        // First remove the ./ and the .ts, then split by / and remove index
        const fileName = file.substring(prefix.length, file.length - '.ts'.length);
        fileName.replace(/\\/g, '/'); // Replace backslashes with forward slashes
        fileName.replace(/(\/|^)index$/, ''); // Remove index at the end, for example: /api/index.ts -> /api

        return [fileName, routeExport];
    });

export default files as [string, RouteExport][];