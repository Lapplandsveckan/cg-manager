import {EventEmitter} from 'events';
import {CasparManager} from '../index';
import {EffectConstructor} from './effect';
import {noTry} from 'no-try';
import {Logger} from '../../util/log';

export class CasparPlugin {
    private _api: PluginAPI;
    private _enabled: boolean = false;
    protected readonly logger = Logger.scope('Plugin').scope(this.pluginName);

    public static readonly pluginName: string;
    public get pluginName() {
        return this.constructor['pluginName'];
    }

    private enable() {
        if (this._enabled) return;
        this._enabled = true;

        const [error] = noTry(this.onEnable);
        if (error) {
            Logger.scope('Plugin Loader').scope(this.pluginName).error(`Error enabling plugin: ${error}`);
            this._enabled = false;
            return;
        }

        Logger.scope('Plugin Loader').scope(this.pluginName).info('Enabled');
    }

    private disable() {
        if (!this._enabled) return;
        this._enabled = false;

        const [error] = noTry(this.onDisable);
        if (error) Logger.scope('Plugin Loader').scope(this.pluginName).error(`Error disabling plugin: ${error}`);
        else Logger.scope('Plugin Loader').scope(this.pluginName).info('Disabled');
    }

    protected onEnable() {

    }

    protected onDisable() {

    }

    protected get api() {
        return this._api;
    }
}

export class PluginAPI extends EventEmitter {
    public constructor(private _manager: CasparManager, private _plugin: CasparPlugin) {
        super();
        this._plugin['_api'] = this;
    }

    public registerEffect(name: string, effect: EffectConstructor) {
        this._manager.effects.register(name, effect);
    }
}

export class PluginManager {
    private _plugins: CasparPlugin[] = [];
    public register(plugin: typeof CasparPlugin) {
        const _plugin = new plugin();
        this._plugins.push(_plugin);

        new PluginAPI(CasparManager.getManager(), _plugin);
        if (this._enabled) _plugin['enable']();
    }

    public unregister(plugin: CasparPlugin) {
        const index = this._plugins.indexOf(plugin);
        if (index < 0) return;

        this._plugins.splice(index, 1);
        plugin['disable']();
    }

    public get plugins() {
        return this._plugins;
    }

    private _enabled: boolean = false;
    public enableAll() {
        if (this._enabled) return;
        this._enabled = true;

        for (const plugin of this._plugins) plugin['enable']();
    }

    public disableAll() {
        if (!this._enabled) return;
        this._enabled = false;

        for (const plugin of this._plugins) plugin['disable']();
    }

    public get enabled() {
        return this._enabled;
    }

    public broadcast(event: string, ...args: any[]) {
        for (const plugin of this._plugins) plugin['_api'].emit(event, ...args);
    }
}