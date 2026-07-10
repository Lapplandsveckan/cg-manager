import * as path from 'path';
import { promises as fs, readdirSync, statSync } from 'fs';
import { noTry, noTryAsync } from 'no-try';
import { Logger } from '../util/log';
import { compareVersions, sanitizeVersion, TOMBSTONE_PREFIX } from './install';

/** Temp-dir prefix used mid-migration by migrateFlatLayout. Dotted so it's
 *  skipped by listPluginFolders; swept on the next migration pass. */
const MIGRATION_PREFIX = '.mig-';

export interface InstalledVersion {
    version: string;
    dir: string;
    mtimeMs: number;
}

/** List the top-level external-plugin folders under pluginsDir. Mirrors the
 *  dotted-name skip in loadPluginFolder/CLI scanExternal — folder names are
 *  always dot-free (sanitizeName strips them), so this also naturally skips
 *  `.trash-*` tombstones. */
export async function listPluginFolders(pluginsDir: string): Promise<string[]> {
    const [readErr, entries] = await noTryAsync(() =>
        fs.readdir(pluginsDir, { withFileTypes: true }),
    );
    if (readErr) return [];

    return entries
        .filter(e => e.isDirectory() && !e.name.includes('.'))
        .map(e => e.name);
}

/** List installed versions of a plugin, newest-first. A subfolder only
 *  counts as an installed version if it has its own package.json. */
export async function listVersions(
    pluginsDir: string,
    folderName: string,
): Promise<InstalledVersion[]> {
    const dir = path.join(pluginsDir, folderName);
    const [readErr, entries] = await noTryAsync(() =>
        fs.readdir(dir, { withFileTypes: true }),
    );
    if (readErr) return [];

    const versions: InstalledVersion[] = [];
    for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith(TOMBSTONE_PREFIX))
            continue;

        const versionDirPath = path.join(dir, entry.name);
        const [pkgErr] = await noTryAsync(() =>
            fs.access(path.join(versionDirPath, 'package.json')),
        );
        if (pkgErr) continue;

        const [statErr, stat] = await noTryAsync(() => fs.stat(versionDirPath));
        versions.push({
            version: entry.name,
            dir: versionDirPath,
            mtimeMs: statErr ? 0 : stat.mtimeMs,
        });
    }

    return versions.sort(
        (a, b) =>
            compareVersions(b.version, a.version) || b.mtimeMs - a.mtimeMs,
    );
}

/** Synchronous twin of listVersions, for callers that need an up-to-date
 *  version list without going async (e.g. refreshing PluginManager's
 *  in-memory cache from inside a sync register() call). */
export function listVersionsSync(
    pluginsDir: string,
    folderName: string,
): InstalledVersion[] {
    const dir = path.join(pluginsDir, folderName);
    const [readErr, entries] = noTry(() =>
        readdirSync(dir, { withFileTypes: true }),
    );
    if (readErr) return [];

    const versions: InstalledVersion[] = [];
    for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith(TOMBSTONE_PREFIX))
            continue;

        const versionDirPath = path.join(dir, entry.name);
        const [statErr, stat] = noTry(() => statSync(versionDirPath));
        if (statErr) continue;

        const [pkgErr] = noTry(() =>
            statSync(path.join(versionDirPath, 'package.json')),
        );
        if (pkgErr) continue;

        versions.push({
            version: entry.name,
            dir: versionDirPath,
            mtimeMs: stat.mtimeMs,
        });
    }

    return versions.sort(
        (a, b) =>
            compareVersions(b.version, a.version) || b.mtimeMs - a.mtimeMs,
    );
}

/** Absolute path to a specific (possibly not-yet-installed) version dir. */
export function versionDir(
    pluginsDir: string,
    folderName: string,
    version: string,
): string {
    return path.join(pluginsDir, folderName, sanitizeVersion(version));
}

/** Resolve which installed version should be active: the state-selected one
 *  if it still exists on disk, otherwise the newest installed version.
 *  Returns null if no versions are installed. */
export async function resolveActiveVersion(
    pluginsDir: string,
    folderName: string,
    active: Record<string, string>,
): Promise<InstalledVersion | null> {
    const versions = await listVersions(pluginsDir, folderName);
    if (versions.length === 0) return null;

    const selected = active[folderName];
    if (selected) {
        const match = versions.find(v => v.version === selected);
        if (match) return match;
    }

    return versions[0];
}

/** Migrate a plugin folder from the old flat layout
 *  (`plugins-dir/<name>/package.json`) into the versioned layout
 *  (`plugins-dir/<name>/<version>/package.json`). Idempotent — folders
 *  already nested (no package.json directly inside) are left untouched.
 *  Defensive — any failure is logged and skipped rather than thrown, so one
 *  bad folder can't block startup. */
export async function migrateFlatLayout(pluginsDir: string): Promise<void> {
    const logger = Logger.scope('Plugin Installer');

    // Sweep leftover temp dirs from a migration that crashed mid-rename —
    // they're dotted (invisible to listPluginFolders) so nothing else cleans
    // them, and their presence would fail this pass's rename onto them.
    const [, allEntries] = await noTryAsync(() =>
        fs.readdir(pluginsDir, { withFileTypes: true }),
    );
    for (const entry of allEntries ?? []) {
        if (!entry.isDirectory() || !entry.name.startsWith(MIGRATION_PREFIX))
            continue;
        await noTryAsync(() =>
            fs.rm(path.join(pluginsDir, entry.name), {
                recursive: true,
                force: true,
            }),
        );
    }

    const folders = await listPluginFolders(pluginsDir);

    for (const folderName of folders) {
        const folderPath = path.join(pluginsDir, folderName);
        const pkgPath = path.join(folderPath, 'package.json');
        const [accessErr] = await noTryAsync(() => fs.access(pkgPath));
        if (accessErr) continue; // already nested, or empty

        const [readErr, raw] = await noTryAsync(() =>
            fs.readFile(pkgPath, 'utf8'),
        );
        if (readErr) {
            logger.warn(
                `Skipping migration of "${folderName}": failed to read package.json`,
            );
            continue;
        }

        const [parseErr, pkg] = await noTryAsync(async () => JSON.parse(raw));
        const version = sanitizeVersion(
            parseErr ? undefined : (pkg?.version as string | undefined),
        );

        const tempDir = path.join(
            pluginsDir,
            `${MIGRATION_PREFIX}${folderName}`,
        );
        const versionedDir = path.join(folderPath, version);

        const [migErr] = await noTryAsync(async () => {
            await fs.rename(folderPath, tempDir);
            await fs.mkdir(folderPath, { recursive: true });
            await fs.rename(tempDir, versionedDir);
        });

        if (migErr) {
            logger.error(
                `Failed to migrate plugin "${folderName}" to versioned layout: ${Logger.formatError(migErr)}`,
            );
            // Best-effort: move back if the folder is now missing.
            await noTryAsync(() => fs.rename(tempDir, folderPath));
            continue;
        }

        logger.info(
            `Migrated plugin "${folderName}" to versioned layout (v${version})`,
        );
    }
}
