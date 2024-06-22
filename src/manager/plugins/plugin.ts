import {CasparPlugin, PluginAPI} from '@lappis/cg-manager';
import {Logger} from '../../util/log';
import {CasparManager} from '../index';

export class PluginManager {
    private _plugins: CasparPlugin[] = [];
    public register(plugin: typeof CasparPlugin) {
        const _plugin = new plugin();
        this._plugins.push(_plugin);

        Logger.scope('Plugin Loader').scope(_plugin.pluginName).debug('Loaded');

        new PluginAPI(CasparManager.getManager() as any, _plugin);
        if (this._enabled) _plugin['enable'](Logger.scope('Plugin Loader').scope(plugin.pluginName));
    }

    public unregister(plugin: CasparPlugin) {
        const index = this._plugins.indexOf(plugin);
        if (index < 0) return;

        this._plugins.splice(index, 1);
        plugin['disable'](Logger.scope('Plugin Loader').scope(plugin.pluginName));
    }

    public get plugins() {
        return this._plugins;
    }

    private _enabled: boolean = false;
    public enableAll() {
        if (this._enabled) return;
        this._enabled = true;

        for (const plugin of this._plugins) plugin['enable'](Logger.scope('Plugin Loader').scope(plugin.pluginName));
    }

    public disableAll() {
        if (!this._enabled) return;
        this._enabled = false;

        for (const plugin of this._plugins) plugin['disable'](Logger.scope('Plugin Loader').scope(plugin.pluginName));
    }

    public get enabled() {
        return this._enabled;
    }

    public broadcast(event: string, ...args: any[]) {
        for (const plugin of this._plugins) plugin['_api'].emit(event, ...args);
    }
}