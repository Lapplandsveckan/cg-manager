import * as path from 'path';
import { promises as fs } from 'fs';
import AdmZip from 'adm-zip';
import { noTry, noTryAsync } from 'no-try';
import { type CasparPlugin } from '@lappis/cg-manager';
import { Logger } from '../util/log';

export const TOMBSTONE_PREFIX = '.trash-';

/**
 * Remove a plugin directory, falling back to a tombstone rename when native
 * .node addons hold OS-level locks (Windows). Tombstones are swept at next
 * startup by sweepTombstones(). Throws only if both rm and rename fail.
 */
export async function removeOrTombstone(dir: string): Promise<void> {
    const [rmErr] = await noTryAsync(() =>
        fs.rm(dir, { recursive: true, force: true }),
    );
    if (!rmErr) return;

    // rm failed — try to rename aside so the folder is invisible to
    // loadPluginFolder (dotted entries are skipped) and swept next restart.
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

/** Remove any `.trash-*` entries directly inside `dir`. Shared by the
 *  top-level and per-plugin (versioned) sweep passes. */
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
        if (err)
            logger.warn(`Failed to sweep tombstone "${full}": ${err.message}`);
        else logger.info(`Swept tombstone "${full}"`);
    }
}

/** Remove any tombstone folders left from previous sessions, both at the
 *  top level (whole-plugin removals) and one level deep inside each plugin
 *  folder (single-version removals). Called once at startup before plugins
 *  are loaded, when native addons are not yet locked. */
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

/** Strips characters that would break the folder loader (dotted names are
 *  skipped by loadPluginFolder) and sanitize npm scopes / slashes. */
export function sanitizeName(name: string): string {
    // Strip npm scope prefix (@scope/name → name)
    const stripped = name.startsWith('@') ? name.split('/').pop()! : name;
    // Replace anything that isn't safe as a directory name
    return stripped.replace(/[^A-Za-z0-9_-]/g, '_');
}

/** Sanitize a version string for use as a directory name. Unlike
 *  sanitizeName, dots/plus are kept since version subfolders are scanned
 *  explicitly and never go through the dotted-name folder filter. */
export function sanitizeVersion(version: string | undefined): string {
    if (!version) return 'unknown';
    const cleaned = version.replace(/[^A-Za-z0-9._+-]/g, '_');
    return cleaned || 'unknown';
}

/** Split a version into comparable segments: numeric runs compare
 *  numerically, everything else compares as a string. Good enough for
 *  semver-ish plugin versions without pulling in a semver dependency. */
function versionSegments(version: string): (string | number)[] {
    return version
        .split(/[.-]/)
        .map(part => (/^\d+$/.test(part) ? Number(part) : part));
}

/** Compare two version strings for sorting newest-first. Numeric segments
 *  compare numerically; mismatched types fall back to string compare.
 *  Returns >0 if `a` is newer than `b`. */
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

/** Locate package.json inside the zip, either at root or inside a single
 *  top-level folder. Returns the prefix path (e.g. "" or "myplugin/"). */
function findPackageJsonPrefix(zip: AdmZip): string | null {
    const entries = zip.getEntries().map(e => e.entryName);

    // Root-level package.json
    if (entries.includes('package.json')) return '';

    // Single top-level folder containing package.json
    const topLevel = new Set(entries.map(e => e.split('/')[0]));
    if (topLevel.size === 1) {
        const [folder] = topLevel;
        const candidate = `${folder}/package.json`;
        if (entries.includes(candidate)) return `${folder}/`;
    }

    return null;
}

/** Guard against zip-slip: every extracted path must resolve inside destDir. */
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

/** Extract a .cgplugin zip into pluginsDir and return the installed folder. */
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

    // Clear only this version's folder (handles re-uploading the same
    // name+version) — sibling versions are left untouched so they remain
    // available for rollback. removeOrTombstone handles the Windows
    // native-addon lock case gracefully.
    await removeOrTombstone(destDir);
    await fs.mkdir(destDir, { recursive: true });

    // Extract only the entries under the prefix, guarding against zip-slip
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

/** Purge all require.cache entries for a plugin directory so Node releases
 *  its file handles. On Windows this is required before deleting the folder. */
export function purgePluginCache(dir: string) {
    const resolvedDir = path.resolve(dir);
    for (const key of Object.keys(require.cache)) {
        if (key === resolvedDir || key.startsWith(resolvedDir + path.sep))
            delete require.cache[key];
    }
}

/** Clear require cache for a plugin dir and re-require it, returning the
 *  default-exported CasparPlugin class. Throws on any validation failure. */
export function loadSinglePlugin(dir: string): typeof CasparPlugin {
    // Purge the module and all its children from require cache so hot-reload
    // picks up the new version on update.
    const resolvedDir = path.resolve(dir);
    purgePluginCache(resolvedDir);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(resolvedDir);
    const plugin = mod?.default as typeof CasparPlugin | undefined;
    if (!plugin) throw new Error(`Plugin at "${dir}" has no default export`);

    return plugin;
}
