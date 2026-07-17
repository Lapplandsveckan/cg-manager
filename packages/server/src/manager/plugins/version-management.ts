import path from 'path';
import { noTry } from 'no-try';
import { type CasparPlugin } from '@lappis/cg-manager';
import { Logger } from '../../util/log';
import {
    sanitizeName,
    purgePluginCache,
    removeOrTombstone,
    loadSinglePlugin,
} from '../../plugins/install';
import { versionDir, listVersionsSync } from '../../plugins/versions';
import { CasparManager } from '../index';
import { type PluginManager } from './plugin';

/** Install/version lifecycle for external (uploaded) plugins — split out of
 *  `PluginManager` since it's a self-contained concern layered on top of
 *  register/unregister rather than part of the enable/disable/gating core.
 *  Reaches into `PluginManager`'s private state via bracket access (same
 *  "privacy is advisory" convention used elsewhere in this codebase). */
export class PluginVersionManager {
    public constructor(private manager: PluginManager) {}

    /** Hot-load a plugin from a directory that's already on disk.
     *  If a plugin from the same source folder is already registered, it is
     *  unregistered first (update path) — matched by folderName when given,
     *  so a version whose class renamed pluginName is still swapped out
     *  cleanly; otherwise falls back to matching by pluginName. The new
     *  plugin is registered; enabling is conditional on `_enabled` and not
     *  being in the disabled set. */
    public installFromDir(
        dir: string,
        pluginClass: typeof CasparPlugin,
        folderName?: string,
    ) {
        const label =
            (pluginClass as any).pluginName ?? pluginClass.name ?? 'unknown';

        const existing = folderName
            ? this.manager['_plugins'].find(
                  (p: CasparPlugin) =>
                      this.manager['_folderNames'].get(p.pluginName) ===
                      folderName,
              )
            : this.manager['_plugins'].find(
                  (p: CasparPlugin) => p.pluginName === label,
              );
        if (existing) this.manager.unregister(existing);

        this.manager.register(pluginClass, dir);
        Logger.scope('Plugin Loader').info(
            `Installed plugin "${label}" from ${dir}`,
        );
    }

    /** Switch (or initially activate) which installed version of an
     *  external plugin is running. Used both by the upload-completion hook
     *  (auto-activate the freshly uploaded version) and by the rollback UI
     *  (activate a previously installed version). Preserves enable state
     *  across the swap, provided the plugin's pluginName is stable between
     *  versions. */
    public async setActiveVersion(
        folderName: string,
        version: string,
    ): Promise<void> {
        const dir = versionDir(this.manager['pluginsDir'], folderName, version);
        const logger = Logger.scope('Plugin Loader').scope(folderName);

        const [loadErr, pluginClass] = noTry(() => loadSinglePlugin(dir));
        if (loadErr) {
            logger.error(
                `Failed to load version "${version}": ${Logger.formatError(loadErr)}`,
            );
            throw loadErr;
        }

        // Purge the outgoing version's require cache separately — it's a
        // different path than `dir` and won't be touched by loadSinglePlugin.
        const previous = this.manager['_plugins'].find(
            (p: CasparPlugin) =>
                this.manager['_folderNames'].get(p.pluginName) === folderName,
        );
        const previousDir = previous
            ? this.manager['_pluginDirs'].get(previous.pluginName)
            : undefined;
        if (previousDir && previousDir !== dir) purgePluginCache(previousDir);

        this.manager['_active'][folderName] = version;
        this.installFromDir(dir, pluginClass, folderName);
        await this.manager['saveState']();
        CasparManager.getManager().emit('plugin-list-changed');
        logger.info(`Activated version ${version}`);
    }

    /** Remove a single installed version. If it's the only version, this
     *  delegates to a full uninstall. If it's the active version, the
     *  newest remaining version is activated automatically. */
    public async removeVersion(
        folderName: string,
        version: string,
    ): Promise<void> {
        const versions = listVersionsSync(
            this.manager['pluginsDir'],
            folderName,
        );
        const target = versions.find(v => v.version === version);
        if (!target)
            throw new Error(
                `Version "${version}" of plugin "${folderName}" not found`,
            );

        if (versions.length === 1) {
            const plugin = this.manager['_plugins'].find(
                (p: CasparPlugin) =>
                    this.manager['_folderNames'].get(p.pluginName) ===
                    folderName,
            );
            await this.uninstall(plugin?.pluginName ?? folderName);
            return;
        }

        const wasActive =
            (this.manager['_active'][folderName] ?? versions[0].version) ===
            version;

        purgePluginCache(target.dir);
        await removeOrTombstone(target.dir);

        if (wasActive) {
            delete this.manager['_active'][folderName];
            const remaining = listVersionsSync(
                this.manager['pluginsDir'],
                folderName,
            );
            if (remaining[0])
                await this.setActiveVersion(folderName, remaining[0].version);
        } else {
            this.manager['refreshVersions'](folderName);
            await this.manager['saveState']();
            CasparManager.getManager().emit('plugin-list-changed');
        }
    }

    /** Disable, unregister, and delete the entire plugin folder (every
     *  installed version) from disk. */
    public async uninstall(name: string) {
        const plugin = this.manager['_plugins'].find(
            (p: CasparPlugin) => p.pluginName === name,
        );
        if (!plugin) throw new Error(`Plugin "${name}" not found`);
        if (this.manager.isBuiltin(name))
            throw new Error(
                `Plugin "${name}" is built-in and cannot be uninstalled`,
            );

        const folderName =
            this.manager['_folderNames'].get(name) ?? sanitizeName(name);

        this.manager.unregister(plugin);
        // Broadcast immediately — the plugin is already gone from the running
        // process. This fires even if the folder deletion below fails.
        CasparManager.getManager().emit('plugin-list-changed');

        const folderDir = path.join(this.manager['pluginsDir'], folderName);

        // Purge JS module cache for every version, then remove the whole
        // folder. removeOrTombstone handles Windows native-addon locks by
        // renaming aside for next-restart cleanup.
        purgePluginCache(folderDir);
        await removeOrTombstone(folderDir);

        delete this.manager['_active'][folderName];
        this.manager['_versions'].delete(folderName);
        await this.manager['saveState']();

        Logger.scope('Plugin Loader').info(`Uninstalled plugin "${name}"`);
    }
}
