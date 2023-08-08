import {noTry} from 'no-try';
import {promises as fs} from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';

export function getId(fileDir: string, filePath: string) {
    return path
        .relative(fileDir, filePath) /* take file name without path */
        .replace(/\.[^/.]+$/, '')    /* remove last extension */
        .replace(/\\+/g, '/')        /* replace (multiple)backslashes with forward slashes */
        .toUpperCase();
}

export async function getGDDScriptElement(filePath: string) {
    const html = await fs.readFile(filePath);
    const gddScripts = cheerio.load(html)('script[name="graphics-data-definition"]');
    if (gddScripts.length === 0) return undefined;

    return gddScripts.first();
}

export async function extractGDDJSON(filePath: string, scriptElem) {
    const src = scriptElem.attr('src');

    let gddContent = scriptElem.text();
    if (src) {
        const externalGDDPath = path.resolve(path.dirname(filePath), src);

        gddContent = await fs.readFile(externalGDDPath, {encoding: 'utf-8'}).catch(() => null);
        if (gddContent === null) throw new Error(`Failed to read external GDD "${src}" from "${filePath}", does the file exist?`);
    }

    const [error, result] = noTry(() => JSON.parse(gddContent));
    if (error) throw new Error(`Failed to parse GDD from "${filePath}", is it valid JSON?`);

    return result;
}