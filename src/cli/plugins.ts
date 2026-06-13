import path from 'path';
import { promises as fs } from 'fs';
import { noTry, noTryAsync } from 'no-try';
import { type CasparPlugin } from '@lappis/cg-manager';
import config, { loadConfigQuiet } from '../util/config';
import { readDisabled, writeDisabled } from '../plugins/state';
import {
    extractCgPlugin,
    purgePluginCache,
    loadSinglePlugin,
} from '../plugins/install';
import files from '../plugins/_plugins';

interface PluginEntry {
    id: string;
    folder: string;
    dir: string;
    builtin: boolean;
}

/** Scan pluginsDir and resolve each folder's pluginName via require().
 *  Falls back to the folder name when instantiation fails. */
async function scanExternal(pluginsDir: string): Promise<PluginEntry[]> {
    const [readErr, entries] = await noTryAsync(() => fs.readdir(pluginsDir));
    if (readErr) return [];

    const result: PluginEntry[] = [];
    for (const folder of entries) {
        if (folder.includes('.')) continue;
        const dir = path.join(pluginsDir, folder);
        const [, pluginClass] = noTry(() => loadSinglePlugin(dir));
        let id = folder;
        if (pluginClass) {
            const [, inst] = noTry(
                () => new (pluginClass as typeof CasparPlugin)(),
            );
            if (inst) id = inst.pluginName;
        }
        result.push({ id, folder, dir, builtin: false });
    }
    return result;
}

function builtinEntries(): PluginEntry[] {
    return files.map(({ plugin, dir }) => {
        const [, inst] = noTry(() => new plugin());
        const id = inst?.pluginName ?? plugin.name ?? path.basename(dir);
        return { id, folder: path.basename(dir), dir, builtin: true };
    });
}

function printUsage() {
    console.log(`Usage: manager plugins <command>

Commands:
  list                   List all plugins and their enabled state
  install <file>         Install a .cgplugin file
  uninstall <name>       Remove a plugin and delete its folder
  enable <name>          Mark a plugin as enabled
  disable <name>         Mark a plugin as disabled
`);
}

export async function runPluginCli(args: string[]): Promise<void> {
    if (process.env.CASPAR_DIR) process.chdir(process.env.CASPAR_DIR);
    await loadConfigQuiet();

    const pluginsDir = path.resolve(process.cwd(), config['plugins-dir']);
    const cmd = args[0];

    if (!cmd || cmd === '--help' || cmd === '-h') {
        printUsage();
        return;
    }

    if (cmd === 'list') {
        const disabled = await readDisabled();
        const external = await scanExternal(pluginsDir);
        const builtins = builtinEntries();
        const all = [...builtins, ...external];

        if (all.length === 0) {
            console.log('No plugins found.');
            return;
        }

        const maxLen = Math.max(...all.map(p => p.id.length));
        for (const p of all) {
            const tags = [
                p.builtin ? 'builtin' : 'external',
                disabled.has(p.id) ? 'disabled' : 'enabled',
            ].join(', ');
            console.log(`  ${p.id.padEnd(maxLen)}  [${tags}]`);
        }
        return;
    }

    if (cmd === 'install') {
        const file = args[1];
        if (!file) {
            console.error('Error: install requires a .cgplugin file path.');
            process.exit(1);
        }
        if (!file.endsWith('.cgplugin')) {
            console.error(
                `Error: "${file}" does not look like a .cgplugin file.`,
            );
            process.exit(1);
        }

        const absFile = path.resolve(file);
        const [statErr] = await noTryAsync(() => fs.stat(absFile));
        if (statErr) {
            console.error(`Error: file not found: ${absFile}`);
            process.exit(1);
        }

        await fs.mkdir(pluginsDir, { recursive: true });
        const result = await extractCgPlugin(absFile, pluginsDir);
        console.log(
            `Installed "${result.name}" v${result.version} → ${result.dir}`,
        );
        return;
    }

    if (cmd === 'uninstall') {
        const name = args[1];
        if (!name) {
            console.error('Error: uninstall requires a plugin name.');
            process.exit(1);
        }

        // Resolve dir — prefer scanned entry so we match the live pluginName.
        const external = await scanExternal(pluginsDir);
        const entry = external.find(p => p.id === name || p.folder === name);
        if (!entry) {
            console.error(`Error: plugin "${name}" not found in ${pluginsDir}`);
            process.exit(1);
        }

        const builtins = builtinEntries();
        if (builtins.some(b => b.id === entry.id)) {
            console.error(
                `Error: "${entry.id}" is a built-in plugin and cannot be uninstalled.`,
            );
            process.exit(1);
        }

        purgePluginCache(entry.dir);

        const delays = [100, 300];
        let lastErr: Error | null = null;
        for (let attempt = 0; attempt <= delays.length; attempt++) {
            const [rmErr] = await noTryAsync(() =>
                fs.rm(entry.dir, { recursive: true, force: true }),
            );
            if (!rmErr) {
                lastErr = null;
                break;
            }
            lastErr = rmErr;
            if (attempt < delays.length)
                await new Promise<void>(r => setTimeout(r, delays[attempt]));
        }
        if (lastErr) {
            console.error(
                `Error: failed to delete "${entry.dir}": ${lastErr.message}`,
            );
            process.exit(1);
        }

        // Remove from disabled set if present.
        const disabled = await readDisabled();
        if (disabled.delete(entry.id)) await writeDisabled(disabled);

        console.log(`Uninstalled "${entry.id}".`);
        return;
    }

    if (cmd === 'enable' || cmd === 'disable') {
        const name = args[1];
        if (!name) {
            console.error(`Error: ${cmd} requires a plugin name.`);
            process.exit(1);
        }

        // Resolve to the canonical pluginName so the entry matches what
        // PluginManager checks against _disabled at load time.
        const external = await scanExternal(pluginsDir);
        const builtins = builtinEntries();
        const entry = [...builtins, ...external].find(
            p => p.id === name || p.folder === name,
        );
        if (!entry)
            console.warn(
                `Warning: no plugin named "${name}" found on disk; persisting anyway.`,
            );
        const id = entry?.id ?? name;

        const disabled = await readDisabled();
        if (cmd === 'disable') {
            disabled.add(id);
        } else {
            disabled.delete(id);
        }
        await writeDisabled(disabled);
        console.log(
            `Plugin "${id}" ${cmd === 'disable' ? 'disabled' : 'enabled'}.`,
        );
        return;
    }

    console.error(`Unknown command: ${cmd}`);
    printUsage();
    process.exit(1);
}
