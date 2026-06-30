import path from 'path';
import { type CasparPlugin, PluginAPI } from '@lappis/cg-manager';
import { noTry, noTryAsync } from 'no-try';
import { Logger } from '../../util/log';
import config from '../../util/config';
import {
    sanitizeName,
    purgePluginCache,
    removeOrTombstone,
} from '../../plugins/install';
import { readDisabled, writeDisabled } from '../../plugins/state';
import { CasparManager } from '../index';

export class PluginManager {
    private _plugins: CasparPlugin[] = [];
    private _disabled: Set<string> = new Set();
    private _pluginDirs = new Map<string, string>();
    private _builtin = new Set<string>();
    private _minChannels = new Map<string, number>();
    /** Plugins skipped at enable time solely because of insufficient channels. */
    private _channelBlocked = new Set<string>();
    private _channelCount = 0;

    public async loadState() {
        this._disabled = await readDisabled();
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
        const [err] = await noTryAsync(() => writeDisabled(this._disabled));
        if (err)
            Logger.scope('Plugin Loader').error(
                `Failed to save plugin state: ${Logger.formatError(err)}`,
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
        if (builtin) this._builtin.add(_plugin.pluginName);
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
        return this._plugins.map(p => ({
            name: p.pluginName,
            enabled: p['_enabled'] as boolean,
            builtin: this._builtin.has(p.pluginName),
            minChannels: this._minChannels.get(p.pluginName) ?? 0,
        }));
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
     *  If a plugin with the same name is already registered, it is unregistered
     *  first (update path). The new plugin is registered; enabling is conditional
     *  on `_enabled` and not being in the disabled set. */
    public installFromDir(dir: string, pluginClass: typeof CasparPlugin) {
        const label =
            (pluginClass as any).pluginName ?? pluginClass.name ?? 'unknown';

        const existing = this._plugins.find(p => p.pluginName === label);
        if (existing) this.unregister(existing);

        this.register(pluginClass, dir);
        Logger.scope('Plugin Loader').info(
            `Installed plugin "${label}" from ${dir}`,
        );
    }

    /** Disable, unregister, and delete the plugin folder from disk. */
    public async uninstall(name: string) {
        const plugin = this._plugins.find(p => p.pluginName === name);
        if (!plugin) throw new Error(`Plugin "${name}" not found`);
        if (this._builtin.has(name))
            throw new Error(
                `Plugin "${name}" is built-in and cannot be uninstalled`,
            );

        // Capture dir before unregister clears the map.
        const trackedDir = this._pluginDirs.get(name);
        this.unregister(plugin);
        // Broadcast immediately — the plugin is already gone from the running
        // process. This fires even if the folder deletion below fails.
        CasparManager.getManager().emit('plugin-list-changed');

        const dir =
            trackedDir ??
            path.join(
                path.resolve(process.cwd(), config['plugins-dir']),
                sanitizeName(name),
            );

        // Purge JS module cache, then remove the folder. removeOrTombstone
        // handles Windows native-addon locks by renaming aside for next-restart cleanup.
        purgePluginCache(dir);
        await removeOrTombstone(dir);

        Logger.scope('Plugin Loader').info(`Uninstalled plugin "${name}"`);
    }

    public broadcast(event: string, ...args: any[]) {
        for (const plugin of this._plugins) plugin['_api'].emit(event, ...args);
    }
}
