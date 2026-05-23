import {promises as fs} from 'fs';
import * as path from 'path';
import {noTryAsync} from 'no-try';
import {Logger} from '../../util/log';

/**
 * Folder management for the CasparCG media root.
 *
 * The scanner is file-driven, so empty folders are invisible to it. To
 * give the UI a stable view of the folder tree we maintain a placeholder
 * file (`.cgkeep`) inside every directory under the media root. The
 * scanner ignores this filename, but its presence keeps the directory
 * around regardless of whether it contains real media.
 */
export const PLACEHOLDER_NAME = '.cgkeep';
export const MAX_FOLDER_DEPTH = 16;

/** Top-level directory names that are managed internally (currently just
 *  `_internal`, used by `DirectoryManager` to stash plugin-side symlinks).
 *  These are excluded from the listing the UI sees and from placeholder
 *  backfill — they're not user-facing folders. */
const RESERVED_FOLDERS = new Set<string>(['_internal']);

function isReserved(name: string): boolean {
    return RESERVED_FOLDERS.has(name);
}

/** True when a media ID lives under a reserved top-level folder. Use to
 *  hide plugin-internal symlinks from UI consumers (the scanner-facing
 *  endpoints on :8000 still expose them so CasparCG can play them). */
export function isInternalMediaId(id: string): boolean {
    const head = id.split('/', 1)[0];
    return RESERVED_FOLDERS.has(head.toLowerCase());
}

const logger = Logger.scope('Folders');

/** Walk the tree under `root` and yield every directory's relative path,
 *  upper-cased with a trailing slash. Skips symlinks and stops at
 *  `MAX_FOLDER_DEPTH`. */
export async function listAllFolders(root: string): Promise<string[]> {
    const out: string[] = [];

    async function walk(dir: string, prefix: string, depth: number): Promise<void> {
        if (depth > MAX_FOLDER_DEPTH) return;
        const [, entries] = await noTryAsync(() => fs.readdir(dir, {withFileTypes: true}));
        if (!entries) return;
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            if (depth === 0 && isReserved(entry.name)) continue;
            const sub = `${prefix}${entry.name.toUpperCase()}/`;
            out.push(sub);
            await walk(path.join(dir, entry.name), sub, depth + 1);
        }
    }

    await walk(root, '', 0);
    return out;
}

/** Touch a `.cgkeep` in every directory that doesn't already have one. Safe
 *  to call repeatedly — uses `wx` so existing placeholders aren't touched.
 *  Logs but doesn't throw on per-folder errors so a permissions issue on
 *  one subtree can't take the whole manager down. */
export async function ensureFolderPlaceholders(root: string): Promise<void> {
    let touched = 0;

    async function walk(dir: string, depth: number): Promise<void> {
        if (depth > MAX_FOLDER_DEPTH) return;
        const [, entries] = await noTryAsync(() => fs.readdir(dir, {withFileTypes: true}));
        if (!entries) return;

        const hasPlaceholder = entries.some(
            (e) => e.isFile() && e.name === PLACEHOLDER_NAME,
        );
        if (!hasPlaceholder) {
            const [writeErr] = await noTryAsync(() =>
                fs.writeFile(path.join(dir, PLACEHOLDER_NAME), '', {flag: 'wx'}),
            );
            // EEXIST can happen if a parallel writer beat us; benign.
            if (writeErr && (writeErr as NodeJS.ErrnoException).code !== 'EEXIST')
                logger.warn(`couldn't backfill placeholder in ${dir}: ${writeErr.message}`);
            else if (!writeErr) touched++;
        }

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            // Don't recurse into reserved trees — the manager owns those
            // and they don't need placeholders.
            if (depth === 0 && isReserved(entry.name)) continue;
            await walk(path.join(dir, entry.name), depth + 1);
        }
    }

    await walk(root, 0);
    if (touched > 0) logger.info(`backfilled .cgkeep in ${touched} folder(s)`);
}

/** Parse + validate a slash-separated relative path into segments suitable
 *  for `path.join`. Throws via the caller's choice of error type by letting
 *  the segment validator throw `Error`. */
export function normalizeFolderPath(folderPath: string): string[] {
    const segments = folderPath
        .replace(/^\/+/, '')
        .replace(/\/+$/, '')
        .split('/')
        .filter(Boolean);

    if (segments.length === 0) throw new Error('Path is empty');
    if (segments.length > MAX_FOLDER_DEPTH) throw new Error('Path is too deep');

    return segments;
}

/** Remove a folder under `root` iff it's empty or only contains the
 *  `.cgkeep` placeholder. Returns the resolved absolute path that was
 *  removed (useful for logging). Throws on:
 *    - ENOENT: directory doesn't exist
 *    - non-empty: contains anything other than the placeholder
 *    - path escapes root: caught by the caller's resolveSafePath
 *  The caller is responsible for safe-path resolution; pass the
 *  pre-resolved absolute path as `targetAbs`.
 */
export async function removeEmptyFolder(targetAbs: string): Promise<void> {
    const entries = await fs.readdir(targetAbs);
    const stray = entries.filter((name) => name !== PLACEHOLDER_NAME);
    if (stray.length > 0)
        throw new Error(`Folder is not empty (${stray.length} item${stray.length === 1 ? '' : 's'})`);

    // Delete placeholder (if present) before rmdir — rmdir won't touch
    // files. Ignore ENOENT in case it was already missing.
    await noTryAsync(() => fs.unlink(path.join(targetAbs, PLACEHOLDER_NAME)));
    await fs.rmdir(targetAbs);
}
