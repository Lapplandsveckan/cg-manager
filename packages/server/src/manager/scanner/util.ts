import { promises as fs, createReadStream } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as cheerio from 'cheerio';
import { noTry, noTryAsync } from 'no-try';

export function getId(fileDir: string, filePath: string) {
    return path
        .relative(fileDir, filePath)
        .replace(/\.[^/.]+$/, '')
        .replace(/\\+/g, '/')
        .toUpperCase();
}

// Directory variant of getId: no extension strip, so "My.Folder" keeps its dot.
// Callers go through normalizeFolderPath, which rejects the empty media-root id.
export function getFolderId(fileDir: string, folderPath: string) {
    return path
        .relative(fileDir, folderPath)
        .replace(/\\+/g, '/')
        .toUpperCase();
}

export function resolveSafePath(base: string, relative: string): string {
    const baseAbs = path.resolve(base);
    const target = path.resolve(baseAbs, relative);
    if (target !== baseAbs && !target.startsWith(baseAbs + path.sep))
        throw new Error(`Path escapes allowed root: ${relative}`);
    return target;
}

/** CasparCG silently no-ops PLAY on non-ASCII names; diacritics collapse to base letters, others are stripped. */
export function sanitizeMediaPath(p: string): string {
    return p
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^\x20-\x7E]/g, '');
}

function shortHash(input: string): string {
    return crypto.createHash('sha1').update(input).digest('hex').slice(0, 8);
}

async function fileExists(p: string): Promise<boolean> {
    const [err] = await noTryAsync(() => fs.stat(p));
    return !err;
}

/** Resolves to an ASCII-safe, non-colliding path. Hashes the raw path so repeat calls agree:
 *  matchFile hands the browser a mediaId derived from it. */
export async function safeMediaPath(
    rawPath: string,
    mediaRoot: string,
): Promise<string> {
    const sanitized = sanitizeMediaPath(rawPath);
    const dir = path.dirname(sanitized);
    const dirPrefix = dir === '.' || dir === '' ? '' : `${dir}/`;
    const hash = shortHash(rawPath);
    // path.extname('.mp4') is '', so split manually to keep the dot suffix as the extension.
    const base = path.basename(sanitized);
    const lastDot = base.lastIndexOf('.');
    const stem = lastDot < 0 ? base : base.slice(0, lastDot);
    const ext = lastDot < 0 ? '' : base.slice(lastDot);

    const candidate = stem
        ? `${dirPrefix}${stem}${ext}`
        : `${dirPrefix}${hash}${ext}`;
    if (!(await fileExists(path.join(mediaRoot, candidate)))) return candidate;

    const suffixed = stem
        ? `${dirPrefix}${stem}-${hash}${ext}`
        : `${dirPrefix}${hash}-${shortHash(`${rawPath}:suffix`)}${ext}`;
    if (!(await fileExists(path.join(mediaRoot, suffixed)))) return suffixed;

    const nonce = crypto.randomBytes(4).toString('hex');
    const stemOrHash = stem || hash;
    return `${dirPrefix}${stemOrHash}-${hash}-${nonce}${ext}`;
}

// eslint-disable-next-line no-control-regex
const INVALID_FILENAME_CHARS = /[/\\<>:|?*\x00-\x1f]/;

/** Throws on empty, too long, reserved, or invalid names. */
export function validateFilename(name: string): void {
    if (!name || typeof name !== 'string') throw new Error('Name is required');
    if (name.length > 255) throw new Error('Name is too long');
    if (name === '.' || name === '..') throw new Error('Invalid name');
    if (INVALID_FILENAME_CHARS.test(name))
        throw new Error('Name contains invalid characters');
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
    const link = await fs.readlink(filePath).catch(() => null);
    return fs.readFile(link ?? filePath);
}

export async function getGDDScriptElement(filePath: string) {
    const html = await readFile(filePath);
    const gddScripts = cheerio.load(html)(
        'script[name="graphics-data-definition"]',
    );
    if (gddScripts.length === 0) return undefined;

    return gddScripts.first();
}

export async function extractGDDJSON(filePath: string, scriptElem) {
    const src = scriptElem.attr('src');

    let gddContent = scriptElem.text();
    if (src) {
        const externalGDDPath = path.resolve(path.dirname(filePath), src);

        gddContent = await fs
            .readFile(externalGDDPath, { encoding: 'utf-8' })
            .catch(() => null);
        if (gddContent === null)
            throw new Error(
                `Failed to read external GDD "${src}" from "${filePath}", does the file exist?`,
            );
    }

    const [error, result] = noTry(() => JSON.parse(gddContent));
    if (error)
        throw new Error(
            `Failed to parse GDD from "${filePath}", is it valid JSON?`,
        );

    return result;
}
