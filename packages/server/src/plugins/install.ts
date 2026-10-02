import * as path from 'path';
import { promises as fs } from 'fs';
import AdmZip from 'adm-zip';
import { noTry, noTryAsync } from 'no-try';
import { type CasparPlugin } from '@lappis/cg-manager';
import { Logger } from '../util/log';

export const TOMBSTONE_PREFIX = '.trash-';

/** Falls back to a tombstone rename when native addons lock files (Windows). */
export async function removeOrTombstone(dir: string): Promise<void> {
    const [rmErr] = await noTryAsync(() =>
        fs.rm(dir, { recursive: true, force: true }),
    );
    if (!rmErr) return;

    // Dotted names are skipped by loadPluginFolder; swept next restart.
    const tombstone = path.join(
        path.dirname(dir),
        `${TOMBSTONE_PREFIX}${path.basename(dir)}-${Date.now()}`,
    );
    const [renameErr] = await noTryAsync(() => fs.rename(dir, tombstone));
    if (renameErr) throw rmErr;

    Logger.scope('Plugin Installer').warn(
        `Could not delete "${dir}" (locked native module) — deferred to next restart`,
    );
}

async function sweepTombstonesIn(dir: string): Promise<void> {
    const logger = Logger.scope('Plugin Installer');
    const [readErr, entries] = await noTryAsync(() =>
        fs.readdir(dir, { withFileTypes: true }),
    );
    if (readErr) return;

    for (const entry of entries) {
        if (!entry.name.startsWith(TOMBSTONE_PREFIX)) continue;
        const full = path.join(dir, entry.name);
        const [err] = await noTryAsync(() =>
            fs.rm(full, { recursive: true, force: true }),
        );
        if (err) {
            logger.warn(`Failed to sweep tombstone "${full}": ${err.message}`);
            continue;
        }

        logger.info(`Swept tombstone "${full}"`);
    }
}

export async function sweepTombstones(pluginsDir: string): Promise<void> {
    await sweepTombstonesIn(pluginsDir);

    const [readErr, entries] = await noTryAsync(() =>
        fs.readdir(pluginsDir, { withFileTypes: true }),
    );
    if (readErr) return; // dir may not exist yet on first run

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith(TOMBSTONE_PREFIX)) continue;
        await sweepTombstonesIn(path.join(pluginsDir, entry.name));
    }
}

/** Dotted names would be skipped by loadPluginFolder. */
export function sanitizeName(name: string): string {
    const stripped = name.startsWith('@') ? name.split('/').pop()! : name;
    return stripped.replace(/[^A-Za-z0-9_-]/g, '_');
}

/** Unlike sanitizeName keeps dots/plus: version dirs bypass the dotted-name filter. */
export function sanitizeVersion(version: string | undefined): string {
    if (!version) return 'unknown';
    const cleaned = version.replace(/[^A-Za-z0-9._+-]/g, '_');
    return cleaned || 'unknown';
}

// No semver dependency: numeric runs compare numerically.
function versionSegments(version: string): (string | number)[] {
    return version
        .split(/[.-]/)
        .map(part => (/^\d+$/.test(part) ? Number(part) : part));
}

/** Returns >0 if `a` is newer than `b`. */
export function compareVersions(a: string, b: string): number {
    const segA = versionSegments(a);
    const segB = versionSegments(b);
    const len = Math.max(segA.length, segB.length);

    for (let i = 0; i < len; i++) {
        const x = segA[i];
        const y = segB[i];
        if (x === undefined) return -1;
        if (y === undefined) return 1;
        if (x === y) continue;

        if (typeof x === 'number' && typeof y === 'number') return x - y;
        return String(x) < String(y) ? -1 : 1;
    }
    return 0;
}

function findPackageJsonPrefix(zip: AdmZip): string | null {
    const entries = zip.getEntries().map(e => e.entryName);

    if (entries.includes('package.json')) return '';

    const topLevel = new Set(entries.map(e => e.split('/')[0]));
    if (topLevel.size === 1) {
        const [folder] = topLevel;
        const candidate = `${folder}/package.json`;
        if (entries.includes(candidate)) return `${folder}/`;
    }

    return null;
}

function isSafe(destDir: string, entryPath: string): boolean {
    const resolved = path.resolve(destDir, entryPath);
    return (
        resolved.startsWith(path.resolve(destDir) + path.sep) ||
        resolved === path.resolve(destDir)
    );
}

export interface ExtractResult {
    name: string;
    version: string;
    dir: string;
}

export async function extractCgPlugin(
    zipPath: string,
    pluginsDir: string,
): Promise<ExtractResult> {
    const logger = Logger.scope('Plugin Installer');

    const [zipErr, zip] = noTry(() => new AdmZip(zipPath));
    if (zipErr) throw new Error(`Cannot open archive: ${zipErr.message}`);

    const prefix = findPackageJsonPrefix(zip);
    if (prefix === null)
        throw new Error(
            'Archive has no package.json at root or in a single top-level folder',
        );

    const pkgEntry = zip.getEntry(`${prefix}package.json`);
    const [parseErr, pkg] = noTry(() =>
        JSON.parse(pkgEntry!.getData().toString('utf8')),
    );
    if (parseErr || !pkg?.name)
        throw new Error('package.json is missing or has no "name" field');

    const folderName = sanitizeName(pkg.name as string);
    const version = sanitizeVersion(pkg.version as string | undefined);
    const destDir = path.join(pluginsDir, folderName, version);

    // Sibling versions stay for rollback.
    await removeOrTombstone(destDir);
    await fs.mkdir(destDir, { recursive: true });

    const entries = zip.getEntries();
    for (const entry of entries) {
        if (!entry.entryName.startsWith(prefix)) continue;
        if (entry.isDirectory) continue;

        const rel = entry.entryName.slice(prefix.length);
        if (!rel) continue;

        if (!isSafe(destDir, rel))
            throw new Error(`Zip-slip attempt: ${entry.entryName}`);

        const targetPath = path.join(destDir, rel);
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, entry.getData());
    }

    logger.info(`Extracted "${pkg.name as string}" v${version} → ${destDir}`);
    return {
        name: folderName,
        version,
        dir: destDir,
    };
}

/** Windows needs the cache purged before the folder can be deleted. */
export function purgePluginCache(dir: string) {
    const resolvedDir = path.resolve(dir);
    for (const key of Object.keys(require.cache)) {
        if (key === resolvedDir || key.startsWith(resolvedDir + path.sep))
            delete require.cache[key];
    }
}

export function loadSinglePlugin(dir: string): typeof CasparPlugin {
    const resolvedDir = path.resolve(dir);
    purgePluginCache(resolvedDir);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(resolvedDir);
    const plugin = mod?.default as typeof CasparPlugin | undefined;
    if (!plugin) throw new Error(`Plugin at "${dir}" has no default export`);

    return plugin;
}
