import {noTry, noTryAsync} from 'no-try';
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

/**
 * Resolve `relative` against `base` and reject any result that escapes `base`.
 * Guards against `..`, absolute paths, and symlink-style traversal in input
 * strings before we hand them to fs operations.
 */
export function resolveSafePath(base: string, relative: string): string {
    const baseAbs = path.resolve(base);
    const target = path.resolve(baseAbs, relative);
    if (target !== baseAbs && !target.startsWith(baseAbs + path.sep))
        throw new Error(`Path escapes allowed root: ${relative}`);
    return target;
}

/**
 * Replace non-ASCII characters in a path so CasparCG can reference it.
 * Latin diacritics collapse to their base letter (ä → a, é → e, ø → o);
 * non-Latin characters that can't be reduced are stripped. Path
 * separators and ASCII punctuation are preserved.
 *
 * CasparCG's AMCP layer silently no-ops on PLAY for media whose names
 * contain non-ASCII bytes — sanitizing at the point of upload means the
 * file lands at a name the runtime can actually use.
 */
export function sanitizeMediaPath(p: string): string {
    return p
        .normalize('NFD')          // ä → a + combining diaeresis
        .replace(/\p{M}/gu, '')    // strip combining marks
        .replace(/[^\x20-\x7E]/g, ''); // strip remaining non-ASCII
}

function shortHash(input: string): string {
    return crypto.createHash('sha1').update(input).digest('hex').slice(0, 8);
}

async function fileExists(p: string): Promise<boolean> {
    const [err] = await noTryAsync(() => fs.stat(p));
    return !err;
}

/**
 * Resolve `rawPath` (relative to `mediaRoot`) to an ASCII-safe, non-
 * colliding final path. Always returns a path the scanner can index and
 * AMCP can reference.
 *
 * Resolution order:
 *  1. Sanitize via {@link sanitizeMediaPath}.
 *  2. If the basename collapsed to nothing (e.g. `中文.mp4` → `.mp4`),
 *     replace the stem with `shortHash(rawPath)` so we never end up with
 *     anonymous dot-files.
 *  3. If the resulting on-disk path is free, return it.
 *  4. Otherwise append `-<shortHash(rawPath)>` before the extension and
 *     re-check.
 *  5. If even that's taken, append an 8-char random nonce too — at this
 *     point we've stopped trying to be deterministic and just need
 *     somewhere to land.
 *
 * The hash is derived from the *raw* path so the same upload always
 * resolves to the same name. That's important because matchFile returns
 * a mediaId to the browser based on this path; if the resolver gave
 * different answers on second call, the rundown item would reference a
 * file the scanner can't find.
 */
export async function safeMediaPath(rawPath: string, mediaRoot: string): Promise<string> {
    const sanitized = sanitizeMediaPath(rawPath);
    const dir = path.dirname(sanitized);
    const dirPrefix = dir === '.' || dir === '' ? '' : `${dir}/`;
    const hash = shortHash(rawPath);
    // path.extname treats leading-dot basenames as having no extension
    // (`.mp4` → ''). That's the case we hit when sanitization wipes the
    // entire stem — we want the trailing `.<token>` treated as the
    // extension so the hash fallback lands on `<hash>.mp4`, not
    // `<hash>.mp4.mp4` (no ext detected → ext appended again).
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

    // Last resort: layer a random nonce on top. Loses determinism but
    // matchFile callers will already have the suffixed mediaId — if a
    // third upload of the same name lands while two are in flight, the
    // third one wins on the random.
    const nonce = crypto.randomBytes(4).toString('hex');
    const stemOrHash = stem || hash;
    return `${dirPrefix}${stemOrHash}-${hash}-${nonce}${ext}`;
}

const INVALID_FILENAME_CHARS = /[/\\<>:|?*\x00-\x1f]/;

/**
 * Validate a single filename component (no directory parts allowed).
 * Throws on empty, too long, reserved, or character-set violations.
 */
export function validateFilename(name: string): void {
    if (!name || typeof name !== 'string') throw new Error('Name is required');
    if (name.length > 255) throw new Error('Name is too long');
    if (name === '.' || name === '..') throw new Error('Invalid name');
    if (INVALID_FILENAME_CHARS.test(name)) throw new Error('Name contains invalid characters');
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