import {EventEmitter} from 'events';
import {CasparManager} from '../index';
import {EffectConstructor} from './effect';
import {noTry} from 'no-try';
import {Logger} from '../../util/log';
import {Method} from 'rest-exchange-protocol';
import {Route} from 'rest-exchange-protocol/dist/route';
import {UI_INJECTION_ZONE} from './ui';

export class CasparPlugin {
    private _api: PluginAPI;
    private _enabled: boolean = false;
    protected readonly logger = Logger.scope('Plugin').scope(this.pluginName);

    public static get pluginName() {
        return this.name;
    }

    public get pluginName() {
        return this.constructor['pluginName'];
    }

    private enable() {
        if (this._enabled) return;
        this._enabled = true;

        const [error] = noTry(() => this.onEnable());
        if (error) {
            Logger.scope('Plugin Loader').scope(this.pluginName).error(`Error enabling plugin: ${error}`);
            this._enabled = false;
            return;
        }

        Logger.scope('Plugin Loader').scope(this.pluginName).debug('Enabled');
    }

    private disable() {
        if (!this._enabled) return;
        this._enabled = false;

        this['_api']['unregisterEffects']();
        const [error] = noTry(() => this.onDisable());
        if (error) Logger.scope('Plugin Loader').scope(this.pluginName).error(`Error disabling plugin: ${error}`);
        else Logger.scope('Plugin Loader').scope(this.pluginName).debug('Disabled');
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
    private files: string[] = [];
    public constructor(private _manager: CasparManager, private _plugin: CasparPlugin) {
        super();
        this._plugin['_api'] = this;
    }

    private _effects: string[] = [];
    public registerEffect(name: string, effect: EffectConstructor) {
        this._effects.push(name);
        this._manager.effects.register(name, effect);
    }

    private unregisterEffects() {
        for (const effect of this._effects) this._manager.effects.unregister(effect);
        this._effects = [];
    }

    public registerRoute(path: string, handler: Route['handler'], method: Method) {
        this._manager.server.registerRoute(`plugin/${this._plugin.pluginName}/${path}`, handler, method);
    }

    public registerFile(type: 'media' | 'template', path: string) {
        return this._manager.directory.createDirectory(type, path).then(data => {
            this.files.push(data.id);
            return data;
        });
    }

    public unregisterFile(id: string) {
        const index = this.files.indexOf(id);
        if (index < 0) return;

        this.files.splice(index, 1);
        return this._manager.directory.deleteDirectory(id);
    }

    public getDirectory(id: string) {
        if (!this.files.includes(id)) return;
        return this._manager.directory.getDirectory(id);
    }

    public getDirectories() {
        return this.files.map(id => this._manager.directory.getDirectory(id));
    }

    /**
     * @param injectionZone The zone to inject the file into, e.g. UI_INJECTION_ZONE.EFFECT_CREATOR for the effect creator
     * @param file The file to inject, it holds the component as default export
     */
    public registerUI(injectionZone: UI_INJECTION_ZONE, file: string) {
        this._manager.ui.register(injectionZone, file, this._plugin.pluginName);
    }

    /**
     * @deprecated
     */
    public unregisterRoute(path: string, method: Method) {
        this._manager.server.unregisterRoute(`plugin/${this._plugin.pluginName}/${path}`, method);
    }

    public createEffect(name: string, group: string, options: any) {
        const effectGroup = this._manager.executor.getEffectGroup(group);
        return this._manager.effects.create(name, effectGroup, options);
    }

    public getEffect(id: string) {
        return this._manager.executor.getEffect(id);
    }
}

export class PluginManager {
    private _plugins: CasparPlugin[] = [];
    public register(plugin: typeof CasparPlugin) {
        const _plugin = new plugin();
        this._plugins.push(_plugin);

        Logger.scope('Plugin Loader').scope(_plugin.pluginName).debug('Loaded');

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