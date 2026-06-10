import * as path from 'path';
import { promises as fs } from 'fs';
import AdmZip from 'adm-zip';
import { noTry } from 'no-try';
import { type CasparPlugin } from '@lappis/cg-manager';
import { Logger } from '../util/log';

/** Strips characters that would break the folder loader (dotted names are
 *  skipped by loadPluginFolder) and sanitize npm scopes / slashes. */
export function sanitizeName(name: string): string {
    // Strip npm scope prefix (@scope/name → name)
    const stripped = name.startsWith('@') ? name.split('/').pop()! : name;
    // Replace anything that isn't safe as a directory name
    return stripped.replace(/[^A-Za-z0-9_-]/g, '_');
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
    return resolved.startsWith(path.resolve(destDir) + path.sep) ||
        resolved === path.resolve(destDir);
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
        throw new Error('Archive has no package.json at root or in a single top-level folder');

    const pkgEntry = zip.getEntry(`${prefix}package.json`);
    const [parseErr, pkg] = noTry(() =>
        JSON.parse(pkgEntry!.getData().toString('utf8')),
    );
    if (parseErr || !pkg?.name)
        throw new Error('package.json is missing or has no "name" field');

    const folderName = sanitizeName(pkg.name as string);
    const destDir = path.join(pluginsDir, folderName);

    // Clear any previous version (update path) then recreate the folder.
    await fs.rm(destDir, { recursive: true, force: true });
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

    logger.info(`Extracted "${pkg.name as string}" v${pkg.version ?? '?'} → ${destDir}`);
    return { name: folderName, version: (pkg.version as string) ?? 'unknown', dir: destDir };
}

/** Clear require cache for a plugin dir and re-require it, returning the
 *  default-exported CasparPlugin class. Throws on any validation failure. */
export function loadSinglePlugin(dir: string): typeof CasparPlugin {
    // Purge the module and all its children from require cache so hot-reload
    // picks up the new version on update.
    const resolvedDir = path.resolve(dir);
    for (const key of Object.keys(require.cache)) {
        if (key === resolvedDir || key.startsWith(resolvedDir + path.sep))
            delete require.cache[key];
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(resolvedDir);
    const plugin = mod?.default as typeof CasparPlugin | undefined;
    if (!plugin)
        throw new Error(`Plugin at "${dir}" has no default export`);

    return plugin;
}
