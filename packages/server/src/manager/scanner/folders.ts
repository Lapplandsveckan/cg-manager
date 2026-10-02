import { promises as fs } from 'fs';
import * as path from 'path';
import { noTryAsync } from 'no-try';
import { Logger } from '../../util/log';

/** Empty folders are invisible to the file-driven scanner, so every directory holds a `.cgkeep` placeholder. */
export const PLACEHOLDER_NAME = '.cgkeep';
export const MAX_FOLDER_DEPTH = 16;

/** Internal top-level dirs (e.g. `_internal` plugin symlinks), hidden from the UI and placeholder backfill. */
const RESERVED_FOLDERS = new Set<string>(['_internal']);

function isReserved(name: string): boolean {
    return RESERVED_FOLDERS.has(name);
}

/** Recursive deletes must check this first: `fs.rm` has no "not empty" guard. */
export function isReservedTopLevel(segments: string[]): boolean {
    return isReserved((segments[0] ?? '').toLowerCase());
}

/** True when a media ID lives under a reserved folder (hides plugin-internal symlinks from the UI; :8000 still serves them). */
export function isInternalMediaId(id: string): boolean {
    const head = id.split('/', 1)[0];
    return RESERVED_FOLDERS.has(head.toLowerCase());
}

const logger = Logger.scope('Folders');

export async function listAllFolders(root: string): Promise<string[]> {
    const out: string[] = [];

    async function walk(
        dir: string,
        prefix: string,
        depth: number,
    ): Promise<void> {
        if (depth > MAX_FOLDER_DEPTH) return;
        const [, entries] = await noTryAsync(() =>
            fs.readdir(dir, { withFileTypes: true }),
        );
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

/** Touches `.cgkeep` in every directory lacking one (`wx`, so repeat calls are safe). Per-folder errors are logged, not thrown. */
export async function ensureFolderPlaceholders(root: string): Promise<void> {
    let touched = 0;

    async function walk(dir: string, depth: number): Promise<void> {
        if (depth > MAX_FOLDER_DEPTH) return;
        const [, entries] = await noTryAsync(() =>
            fs.readdir(dir, { withFileTypes: true }),
        );
        if (!entries) return;

        const hasPlaceholder = entries.some(
            e => e.isFile() && e.name === PLACEHOLDER_NAME,
        );
        if (!hasPlaceholder) {
            const [writeErr] = await noTryAsync(() =>
                fs.writeFile(path.join(dir, PLACEHOLDER_NAME), '', {
                    flag: 'wx',
                }),
            );
            // EEXIST can happen if a parallel writer beat us; benign.
            if (
                writeErr &&
                (writeErr as NodeJS.ErrnoException).code !== 'EEXIST'
            )
                logger.warn(
                    `couldn't backfill placeholder in ${dir}: ${writeErr.message}`,
                );
            else if (!writeErr) touched++;
        }

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            // Reserved trees are manager-owned; no placeholders.
            if (depth === 0 && isReserved(entry.name)) continue;
            await walk(path.join(dir, entry.name), depth + 1);
        }
    }

    await walk(root, 0);
    if (touched > 0) logger.info(`backfilled .cgkeep in ${touched} folder(s)`);
}

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

/** Removes a folder holding only dotfiles (swept first); throws on ENOENT or real content.
 *  Takes a pre-resolved absolute path. */
export async function removeEmptyFolder(targetAbs: string): Promise<void> {
    const entries = await fs.readdir(targetAbs);
    // Dotfiles (placeholder, sidecars, OS noise) do not count as content.
    const stray = entries.filter(name => !name.startsWith('.'));
    if (stray.length > 0)
        throw new Error(
            `Folder is not empty (${stray.length} item${stray.length === 1 ? '' : 's'})`,
        );

    // Sweep dotfiles so rmdir succeeds; ENOENT means already gone.
    const dotfiles = entries.filter(name => name.startsWith('.'));
    for (const name of dotfiles)
        await noTryAsync(() => fs.unlink(path.join(targetAbs, name)));

    await fs.rmdir(targetAbs);
}

/** Recursive remove; the scanner watcher reconciles each deleted file. `force` makes a missing dir a no-op. */
export async function removeFolderRecursive(targetAbs: string): Promise<void> {
    await fs.rm(targetAbs, { recursive: true, force: true });
}
