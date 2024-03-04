import {noTry} from 'no-try';
import {promises as fs, createReadStream} from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
import * as crypto from 'crypto';

export function getId(fileDir: string, filePath: string) {
    return path
        .relative(fileDir, filePath) /* take file name without path */
        .replace(/\.[^/.]+$/, '')    /* remove last extension */
        .replace(/\\+/g, '/')        /* replace (multiple)backslashes with forward slashes */
        .toUpperCase();
}

export function hashFile(path: string) {
    return new Promise<string>((resolve, reject) => {
        const hash = crypto.createHash('sha1');
        const rs = createReadStream(path);
        rs.on('error', reject);
        rs.on('data', chunk => hash.update(chunk));
        rs.on('end', () => resolve(hash.digest('hex')));
    });
}

export async function readFile(filePath: string) {
    const link = await fs.readlink(filePath).catch(() => null); // check if file is a symlink
    return fs.readFile(link ?? filePath);
}

export async function getGDDScriptElement(filePath: string) {
    const html = await readFile(filePath);
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