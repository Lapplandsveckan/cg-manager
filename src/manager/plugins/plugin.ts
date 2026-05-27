import {CasparPlugin, PluginAPI} from '@lappis/cg-manager';
import {noTry} from 'no-try';
import {Logger} from '../../util/log';
import {CasparManager} from '../index';

export class PluginManager {
    private _plugins: CasparPlugin[] = [];
    public register(plugin: typeof CasparPlugin) {
        const loaderLogger = Logger.scope('Plugin Loader');
        const pluginLabel = (plugin as any).pluginName ?? plugin.name ?? 'unknown';

        const [instErr, _plugin] = noTry(() => new plugin());
        if (instErr) {
            loaderLogger.error(`Failed to instantiate plugin "${pluginLabel}": ${Logger.formatError(instErr)}`);
            return;
        }

        const pluginLogger = loaderLogger.scope(_plugin.pluginName);

        const [apiErr] = noTry(() => new PluginAPI(CasparManager.getManager() as any, _plugin));
        if (apiErr) {
            pluginLogger.error(`Failed to attach plugin API: ${Logger.formatError(apiErr)}`);
            return;
        }

        this._plugins.push(_plugin);
        pluginLogger.debug('Loaded');

        if (this._enabled) this.enablePlugin(_plugin, pluginLogger);
    }

    public unregister(plugin: CasparPlugin) {
        const index = this._plugins.indexOf(plugin);
        if (index < 0) return;

        this._plugins.splice(index, 1);
        const pluginLogger = Logger.scope('Plugin Loader').scope(plugin.pluginName);
        this.disablePlugin(plugin, pluginLogger);
    }

    public get plugins() {
        return this._plugins;
    }

    private _enabled: boolean = false;
    public enableAll() {
        if (this._enabled) return;
        this._enabled = true;

        for (const plugin of this._plugins) {
            const pluginLogger = Logger.scope('Plugin Loader').scope(plugin.pluginName);
            this.enablePlugin(plugin, pluginLogger);
        }
    }

    public disableAll() {
        if (!this._enabled) return;
        this._enabled = false;

        for (const plugin of this._plugins) {
            const pluginLogger = Logger.scope('Plugin Loader').scope(plugin.pluginName);
            this.disablePlugin(plugin, pluginLogger);
        }
    }

    public enablePlugin(plugin: CasparPlugin, logger: Logger) {
        const [err] = noTry(() => plugin['enable'](logger));
        if (err) logger.error(`Failed to enable plugin: ${Logger.formatError(err)}`);
    }

    // Tears the plugin down, then strips any rundown actions it had
    // registered so disabled-plugin types stop appearing in the picker and
    // items keyed off them silently no-op. Ownership is set at registration
    // time by `PluginAPI.registerRundownAction` (which passes the plugin
    // name), so this cleanup catches both sync- and async-registered
    // actions.
    public disablePlugin(plugin: CasparPlugin, logger: Logger) {
        const [err] = noTry(() => plugin['disable'](logger));
        if (err) logger.error(`Failed to disable plugin: ${Logger.formatError(err)}`);
        CasparManager.getManager().rundowns.executor.unregisterActionsByOwner(plugin.pluginName);
    }

    public get enabled() {
        return this._enabled;
    }

    public broadcast(event: string, ...args: any[]) {
        for (const plugin of this._plugins) plugin['_api'].emit(event, ...args);
    }
}
