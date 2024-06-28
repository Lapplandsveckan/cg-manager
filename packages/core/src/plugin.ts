import {EventEmitter} from 'events';
import {Effect, EffectConstructor} from './effect';
import {noTry} from 'no-try';
import {Logger, CasparManager} from './types';
import {Method, WebsocketOutboundMethod} from 'rest-exchange-protocol';
import {Route} from 'rest-exchange-protocol/dist/route';
import {UI_INJECTION_ZONE} from './types/ui';
import {RundownItem} from './types/rundown';

export class CasparPlugin {
    private _api: PluginAPI;
    private _enabled: boolean = false;
    protected logger: Logger;

    public static get pluginName() {
        return this.name;
    }

    public get pluginName() {
        return this.constructor['pluginName'];
    }

    private enable(logger: Logger) {
        if (this._enabled) return;
        this._enabled = true;

        const [error] = noTry(() => this.onEnable());
        if (error) {
            logger.error(`Error enabling plugin: ${error}`);
            this._enabled = false;
            return;
        }

        logger.debug('Enabled');
    }

    private disable(logger: Logger) {
        if (!this._enabled) return;
        this._enabled = false;

        this['_api']['unregister'](); // await?
        const [error] = noTry(() => this.onDisable());
        if (error) logger.error(`Error disabling plugin: ${error}`);
        else logger.debug('Disabled');
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
    private uiInjections: string[] = [];

    private readonly _manager: CasparManager;
    private readonly _plugin: CasparPlugin;
    public constructor(_manager: CasparManager, _plugin: CasparPlugin) {
        super();

        this._manager = _manager;
        this._plugin = _plugin;

        this._plugin['_api'] = this;
        this._plugin['logger'] = _manager.getLogger('Plugin').scope(this._plugin.pluginName);
    }

    private _effects: string[] = [];
    private routes: Route[] = [];
    public registerEffect(name: string, effect: EffectConstructor) {
        this._effects.push(name);
        this._manager.effects.register(name, effect);
    }

    private unregisterEffects() {
        for (const effect of this._effects) this._manager.effects.unregister(effect);
        this._effects = [];
    }

    private unregisterRoutes() {
        for (const route of this.routes) this._manager.server.unregisterRoute(route);
        this.routes = [];
    }

    private async unregisterFiles() {
        for (const file of this.files) await this._manager.directory.deleteDirectory(file);
        this.files = [];
    }

    private unregisterUIInjections() {
        for (const injection of this.uiInjections) this._manager.ui.unregister(injection);
        this.uiInjections = [];
    }

    private unregister() {
        this.unregisterEffects();
        this.unregisterRoutes();
        this.unregisterUIInjections();
        return this.unregisterFiles();
    }

    public registerRoute(path: string, handler: Route['handler'], method: Method) {
        const route = this._manager.server.registerRoute(`plugin/${this._plugin.pluginName}/${path}`, handler, method);
        this.routes.push(route);

        return route;
    }

    public unregisterRoute(route: Route) {
        const index = this.routes.indexOf(route);
        if (index < 0) return;

        this.routes.splice(index, 1);
        this._manager.server.unregisterRoute(route);
    }

    public broadcast(target: string, method: WebsocketOutboundMethod, data: any, exclude?: any) {
        this._manager.server.broadcast(`plugin/${this._plugin.pluginName}/${target}`, method, data, exclude);
    }

    public registerFile(type: 'media' | 'template', path: string) {
        return this._manager.directory.createDirectory(type, path).then(data => {
            this.files.push(data.id);
            return data;
        });
    }

    public getEffectGroup(name: string, index?: number) {
        return this._manager.executor.getEffectGroup(name, index);
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

    public getFileDatabase() {
        return this._manager.getFiles();
    }

    /**
     * @param injectionZone The zone to inject the file into, e.g. UI_INJECTION_ZONE.EFFECT_CREATOR for the effect creator
     * @param file The file to inject, it holds the component as default export
     */
    public registerUI(injectionZone: UI_INJECTION_ZONE, file: string) {
        const id = this._manager.ui.register(injectionZone, file, this._plugin.pluginName);
        this.uiInjections.push(id);
    }

    public unregisterUI(id: string) {
        const index = this.uiInjections.indexOf(id);
        if (index < 0) return;

        this.uiInjections.splice(index, 1);
        this._manager.ui.unregister(id);
    }

    public createEffect<T = Effect>(name: string, group: string, options: any) {
        const effectGroup = this._manager.executor.getEffectGroup(group);
        return this._manager.effects.create(name, effectGroup, options) as T;
    }

    public getEffect(id: string) {
        return this._manager.executor.getEffect(id);
    }

    public registerRundownAction(name: string, handler: (item: RundownItem) => Promise<void> | void) {
        this._manager.rundowns.executor.registerAction(name, handler);
    }

    public enableVideoRoute(id: string) {
        this._manager.routes.enableVideoRoute(id);
    }

    public disableVideoRoute(id: string) {
        this._manager.routes.disableVideoRoute(id);
    }
}