import path from 'path';
import { type CasparPlugin, PluginAPI } from '@lappis/cg-manager';
import { noTry, noTryAsync } from 'no-try';
import { Logger } from '../../util/log';
import config from '../../util/config';
import {
    sanitizeName,
    purgePluginCache,
    removeOrTombstone,
    loadSinglePlugin,
} from '../../plugins/install';
import { versionDir, listVersionsSync } from '../../plugins/versions';
import { readState, writeState } from '../../plugins/state';
import { CasparManager } from '../index';

export class PluginManager {
    private _plugins: CasparPlugin[] = [];
    private _disabled: Set<string> = new Set();
    /** pluginName -> currently loaded dir (active version dir for external
     *  plugins, flat internal dir for built-ins). */
    private _pluginDirs = new Map<string, string>();
    private _builtin = new Set<string>();
    private _minChannels = new Map<string, number>();
    /** Plugins skipped at enable time solely because of insufficient channels. */
    private _channelBlocked = new Set<string>();
    private _channelCount = 0;
    /** folderName -> active version, for external (uploaded) plugins. */
    private _active: Record<string, string> = {};
    /** pluginName -> on-disk folder name. External plugins only — the
     *  runtime identity (pluginName) and the on-disk identity (sanitized
     *  package name) are independent. */
    private _folderNames = new Map<string, string>();
    /** folderName -> installed versions, newest-first. Cached so the sync
     *  list() can include it without hitting disk on every call. */
    private _versions = new Map<string, string[]>();

    private get pluginsDir(): string {
        return path.resolve(process.cwd(), config['plugins-dir']);
    }

    public async loadState() {
        const state = await readState();
        this._disabled = state.disabled;
        this._active = state.active;
    }

    /** Snapshot of the persisted active-version selections, used by the
     *  plugin loader to resolve which version to load at startup. */
    public getActiveMap(): Record<string, string> {
        return { ...this._active };
    }

    public getFolderName(pluginName: string): string | undefined {
        return this._folderNames.get(pluginName);
    }

    public setChannelCount(n: number) {
        this._channelCount = n;
    }

    private _meetsChannels(name: string) {
        return this._channelCount >= (this._minChannels.get(name) ?? 0);
    }

    private _maybeAutoEnable(plugin: CasparPlugin, logger: Logger) {
        const name = plugin.pluginName;
        if (!this._enabled || this._disabled.has(name)) return;
        if (!this._meetsChannels(name)) {
            this._channelBlocked.add(name);
            const need = this._minChannels.get(name) ?? 0;
            logger.debug(
                `Blocked: needs ${need} channel${need === 1 ? '' : 's'}, have ${this._channelCount}`,
            );
            return;
        }
        this._channelBlocked.delete(name);
        this._applyEnable(plugin, logger);
    }

    private async saveState() {
        const [err] = await noTryAsync(() =>
            writeState(this._disabled, this._active),
        );
        if (err)
            Logger.scope('Plugin Loader').error(
                `Failed to save plugin state: ${Logger.formatError(err)}`,
            );
    }

    /** Refresh the in-memory version-list cache for a folder from disk. */
    private refreshVersions(folderName: string) {
        this._versions.set(
            folderName,
            listVersionsSync(this.pluginsDir, folderName).map(v => v.version),
        );
    }

    public register(
        plugin: typeof CasparPlugin,
        dir?: string,
        builtin = false,
    ) {
        const loaderLogger = Logger.scope('Plugin Loader');
        const pluginLabel =
            (plugin as any).pluginName ?? plugin.name ?? 'unknown';

        const [instErr, _plugin] = noTry(() => new plugin());
        if (instErr) {
            loaderLogger.error(
                `Failed to instantiate plugin "${pluginLabel}": ${Logger.formatError(instErr)}`,
            );
            return;
        }

        const pluginLogger = loaderLogger.scope(_plugin.pluginName);

        const [apiErr] = noTry(
            () => new PluginAPI(CasparManager.getManager() as any, _plugin),
        );
        if (apiErr) {
            pluginLogger.error(
                `Failed to attach plugin API: ${Logger.formatError(apiErr)}`,
            );
            return;
        }

        this._plugins.push(_plugin);
        if (dir) this._pluginDirs.set(_plugin.pluginName, dir);
        if (builtin) {
            this._builtin.add(_plugin.pluginName);
        } else if (dir) {
            // dir is `<pluginsDir>/<folderName>/<version>` for external plugins.
            const folderName = path.basename(path.dirname(dir));
            this._folderNames.set(_plugin.pluginName, folderName);
            this.refreshVersions(folderName);
        }
        const minCh = (plugin as any).minChannels ?? 0;
        this._minChannels.set(_plugin.pluginName, minCh);
        pluginLogger.debug('Loaded');

        this._maybeAutoEnable(_plugin, pluginLogger);
    }

    public unregister(plugin: CasparPlugin) {
        const index = this._plugins.indexOf(plugin);
        if (index < 0) return;

        this._plugins.splice(index, 1);
        this._pluginDirs.delete(plugin.pluginName);
        this._builtin.delete(plugin.pluginName);
        this._minChannels.delete(plugin.pluginName);
        this._channelBlocked.delete(plugin.pluginName);
        this._folderNames.delete(plugin.pluginName);
        const pluginLogger = Logger.scope('Plugin Loader').scope(
            plugin.pluginName,
        );
        this._applyDisable(plugin, pluginLogger);
    }

    public get plugins() {
        return this._plugins;
    }

    public isBuiltin(name: string) {
        return this._builtin.has(name);
    }

    /** Serializable plugin list for the API / WS broadcast. */
    public list() {
        return this._plugins.map(p => {
            const folderName = this._folderNames.get(p.pluginName);
            // Derive the displayed active version from the dir actually
            // loaded, rather than the persisted selection — this stays
            // correct even before any explicit setActiveVersion call has
            // persisted a choice (e.g. right after startup discovery).
            const loadedDir = this._pluginDirs.get(p.pluginName);
            const activeVersion = folderName
                ? (this._active[folderName] ??
                  (loadedDir ? path.basename(loadedDir) : undefined))
                : undefined;
            return {
                name: p.pluginName,
                enabled: p['_enabled'] as boolean,
                builtin: this._builtin.has(p.pluginName),
                minChannels: this._minChannels.get(p.pluginName) ?? 0,
                ...(folderName && {
                    folderName,
                    activeVersion,
                    versions: this._versions.get(folderName) ?? [],
                }),
            };
        });
    }

    private _enabled: boolean = false;
    public enableAll() {
        if (this._enabled) return;
        this._enabled = true;

        for (const plugin of this._plugins) {
            const pluginLogger = Logger.scope('Plugin Loader').scope(
                plugin.pluginName,
            );
            this._maybeAutoEnable(plugin, pluginLogger);
        }
    }

    public disableAll() {
        if (!this._enabled) return;
        this._enabled = false;

        for (const plugin of this._plugins) {
            const pluginLogger = Logger.scope('Plugin Loader').scope(
                plugin.pluginName,
            );
            this._applyDisable(plugin, pluginLogger);
        }
    }

    public enablePlugin(plugin: CasparPlugin, logger: Logger) {
        this._channelBlocked.delete(plugin.pluginName);
        this._applyEnable(plugin, logger);
        if (this._disabled.delete(plugin.pluginName)) this.saveState();
        CasparManager.getManager().emit('plugin-list-changed');
    }

    public disablePlugin(plugin: CasparPlugin, logger: Logger) {
        this._channelBlocked.delete(plugin.pluginName);
        this._applyDisable(plugin, logger);
        if (!this._disabled.has(plugin.pluginName)) {
            this._disabled.add(plugin.pluginName);
            this.saveState();
        }
        CasparManager.getManager().emit('plugin-list-changed');
    }

    /** Update the running channel count and auto-enable any blocked plugins now satisfied. */
    public updateChannelCount(n: number) {
        this._channelCount = n;
        let changed = false;
        for (const name of [...this._channelBlocked]) {
            if (!this._meetsChannels(name)) continue;
            const plugin = this._plugins.find(p => p.pluginName === name);
            if (!plugin) {
                this._channelBlocked.delete(name);
                continue;
            }
            const logger = Logger.scope('Plugin Loader').scope(name);
            this._channelBlocked.delete(name);
            this._applyEnable(plugin, logger);
            changed = true;
        }
        if (changed) CasparManager.getManager().emit('plugin-list-changed');
    }

    private _applyEnable(plugin: CasparPlugin, logger: Logger) {
        const [err] = noTry(() => plugin['enable'](logger));
        if (err)
            logger.error(`Failed to enable plugin: ${Logger.formatError(err)}`);
    }

    // Tears the plugin down, then strips any rundown actions it had
    // registered so disabled-plugin types stop appearing in the picker and
    // items keyed off them silently no-op. Ownership is set at registration
    // time by `PluginAPI.registerRundownAction` (which passes the plugin
    // name), so this cleanup catches both sync- and async-registered
    // actions.
    private _applyDisable(plugin: CasparPlugin, logger: Logger) {
        const [err] = noTry(() => plugin['disable'](logger));
        if (err)
            logger.error(
                `Failed to disable plugin: ${Logger.formatError(err)}`,
            );
        const manager = CasparManager.getManager();
        manager.rundowns.executor.unregisterActionsByOwner(plugin.pluginName);
        // CompanionRegistry also tracks sub-cleanup internally, but calling
        // unregisterOwner here ensures the broadcast fires before the plugin's
        // own API teardown clears its handle list.
        manager.companion.unregisterOwner(plugin.pluginName);
    }

    public get enabled() {
        return this._enabled;
    }

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
            ? this._plugins.find(
                  p => this._folderNames.get(p.pluginName) === folderName,
              )
            : this._plugins.find(p => p.pluginName === label);
        if (existing) this.unregister(existing);

        this.register(pluginClass, dir);
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
        const dir = versionDir(this.pluginsDir, folderName, version);
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
        const previous = this._plugins.find(
            p => this._folderNames.get(p.pluginName) === folderName,
        );
        const previousDir = previous
            ? this._pluginDirs.get(previous.pluginName)
            : undefined;
        if (previousDir && previousDir !== dir) purgePluginCache(previousDir);

        this._active[folderName] = version;
        this.installFromDir(dir, pluginClass, folderName);
        await this.saveState();
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
        const versions = listVersionsSync(this.pluginsDir, folderName);
        const target = versions.find(v => v.version === version);
        if (!target)
            throw new Error(
                `Version "${version}" of plugin "${folderName}" not found`,
            );

        if (versions.length === 1) {
            const plugin = this._plugins.find(
                p => this._folderNames.get(p.pluginName) === folderName,
            );
            await this.uninstall(plugin?.pluginName ?? folderName);
            return;
        }

        const wasActive =
            (this._active[folderName] ?? versions[0].version) === version;

        purgePluginCache(target.dir);
        await removeOrTombstone(target.dir);

        if (wasActive) {
            delete this._active[folderName];
            const remaining = listVersionsSync(this.pluginsDir, folderName);
            if (remaining[0])
                await this.setActiveVersion(folderName, remaining[0].version);
        } else {
            this.refreshVersions(folderName);
            await this.saveState();
            CasparManager.getManager().emit('plugin-list-changed');
        }
    }

    /** Disable, unregister, and delete the entire plugin folder (every
     *  installed version) from disk. */
    public async uninstall(name: string) {
        const plugin = this._plugins.find(p => p.pluginName === name);
        if (!plugin) throw new Error(`Plugin "${name}" not found`);
        if (this._builtin.has(name))
            throw new Error(
                `Plugin "${name}" is built-in and cannot be uninstalled`,
            );

        const folderName = this._folderNames.get(name) ?? sanitizeName(name);

        this.unregister(plugin);
        // Broadcast immediately — the plugin is already gone from the running
        // process. This fires even if the folder deletion below fails.
        CasparManager.getManager().emit('plugin-list-changed');

        const folderDir = path.join(this.pluginsDir, folderName);

        // Purge JS module cache for every version, then remove the whole
        // folder. removeOrTombstone handles Windows native-addon locks by
        // renaming aside for next-restart cleanup.
        purgePluginCache(folderDir);
        await removeOrTombstone(folderDir);

        delete this._active[folderName];
        this._versions.delete(folderName);
        await this.saveState();

        Logger.scope('Plugin Loader').info(`Uninstalled plugin "${name}"`);
    }

    public broadcast(event: string, ...args: any[]) {
        for (const plugin of this._plugins) plugin['_api'].emit(event, ...args);
    }
}
