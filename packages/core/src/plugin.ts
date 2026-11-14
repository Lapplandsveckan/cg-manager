import { noTry } from 'no-try';
import {
    type Method,
    type WebsocketOutboundMethod,
    type Route,
} from 'rest-exchange-protocol';
import { type EffectConstructor } from './effect';
import {
    type CasparManager,
    type Logger,
    type HttpHandler,
    type HttpRouter,
} from './types';
import { type RouteRegistration } from './types/server';
import { type UI_INJECTION_ZONE_KEY } from './types/ui';
import { PluginApiBase } from './pluginApiBase';

export class CasparPlugin {
    private _api: PluginAPI;
    private _enabled: boolean = false;
    protected logger: Logger;

    // Optional static hooks, read reflectively by the host. Left undeclared
    // (rather than fields on the base class) since plugins aren't forced to
    // set them:
    //   static minChannels = 2;                           // gates enable on channel count
    //   static dependencies = ['other-plugin'];           // hard: gates enable
    //   static optionalDependencies = ['nice-to-have'];   // soft: orders only
    public static readonly minChannels?: number;
    public static readonly dependencies?: string[];
    public static readonly optionalDependencies?: string[];

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
        if (error) return logger.error(`Error disabling plugin: ${error}`);

        logger.debug('Disabled');
    }

    protected onEnable() {}

    protected onDisable() {}

    protected get api() {
        return this._api;
    }
}

export class PluginAPI extends PluginApiBase {
    public constructor(manager: CasparManager, plugin: CasparPlugin) {
        super(manager, plugin);

        plugin['_api'] = this;
        plugin['logger'] = manager.getLogger('Plugin').scope(plugin.pluginName);
    }

    private files: string[] = [];
    private uiInjections: string[] = [];
    private _effects: string[] = [];
    private routes: Route[] = [];
    private httpHandlers: HttpHandler[] = [];

    public registerEffect(name: string, effect: EffectConstructor) {
        this._effects.push(name);
        this._manager.effects.register(name, effect);
    }

    private unregisterEffects() {
        for (const effect of this._effects)
            this._manager.effects.unregister(effect);
        this._effects = [];
    }

    private unregisterRoutes() {
        for (const route of this.routes)
            this._manager.server.unregisterRoute(route);
        this.routes = [];
    }

    private unregisterHttpHandlers() {
        for (const handler of this.httpHandlers)
            this._manager.server.unregisterHttpHandler(
                this._plugin.pluginName,
                handler,
            );
        this.httpHandlers = [];
    }

    private async unregisterFiles() {
        for (const file of this.files)
            await this._manager.directory.deleteDirectory(file);
        this.files = [];
    }

    private unregisterUIInjections() {
        for (const injection of this.uiInjections)
            this._manager.ui.unregister(injection);
        this.uiInjections = [];
    }

    private unregister() {
        this.unregisterEffects();
        this.unregisterRoutes();
        this.unregisterHttpHandlers();
        this.unregisterUIInjections();
        this.unregisterCompanion();
        this._ingest?.unregister();
        this._manager.interop.unregisterOwner(this._plugin.pluginName);
        return this.unregisterFiles();
    }

    public registerRoute(
        path: string,
        handler: Route['handler'],
        method: Method,
        options?: RouteRegistration,
    ) {
        const route = this._manager.server.registerRoute(
            `plugin/${this._plugin.pluginName}/${path}`,
            handler,
            method,
            options,
        );
        this.routes.push(route);

        return route;
    }

    public unregisterRoute(route: Route) {
        const index = this.routes.indexOf(route);
        if (index < 0) return;

        this.routes.splice(index, 1);
        this._manager.server.unregisterRoute(route);
    }

    public createHttpRouter(): HttpRouter {
        return this._manager.server.createHttpRouter();
    }

    public registerHttpHandler(
        handler: HttpHandler,
        options?: RouteRegistration,
    ) {
        if (this.httpHandlers.includes(handler)) return;

        this._manager.server.registerHttpHandler(
            this._plugin.pluginName,
            handler,
            options,
        );
        this.httpHandlers.push(handler);
    }

    public unregisterHttpHandler(handler: HttpHandler) {
        const index = this.httpHandlers.indexOf(handler);
        if (index < 0) return;

        this.httpHandlers.splice(index, 1);
        this._manager.server.unregisterHttpHandler(
            this._plugin.pluginName,
            handler,
        );
    }

    public getHttpPath(subPath = '') {
        const name = encodeURIComponent(this._plugin.pluginName);
        return `/api/plugin-http/${name}/${subPath.replace(/^\/+/, '')}`;
    }

    public broadcast(
        target: string,
        method: WebsocketOutboundMethod,
        data: unknown,
        // Stays `any` rather than `Client`: a plugin author's own copy of
        // `rest-exchange-protocol` (if it resolves separately from the
        // host's) would make a nominally-typed `Client` param a breaking
        // change for a value that is structurally identical.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        exclude?: any,
    ) {
        this._manager.server.broadcast(
            `plugin/${this._plugin.pluginName}/${target}`,
            method,
            data,
            exclude,
        );
    }

    public registerFile(type: 'media' | 'template', path: string) {
        return this._manager.directory
            .createDirectory(type, path)
            .then(data => {
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
     * @param injectionZone The zone to inject the file into, e.g. UI_INJECTION_ZONE.EFFECT_CREATOR
     *   for the effect creator, or a plugin-defined zone (`plugin:<name>`) to extend another plugin's UI.
     * @param file The file to inject, it holds the component as default export
     */
    public registerUI(injectionZone: UI_INJECTION_ZONE_KEY, file: string) {
        const id = this._manager.ui.register(
            injectionZone,
            file,
            this._plugin.pluginName,
        );
        this.uiInjections.push(id);
    }

    public unregisterUI(id: string) {
        const index = this.uiInjections.indexOf(id);
        if (index < 0) return;

        this.uiInjections.splice(index, 1);
        this._manager.ui.unregister(id);
    }
}
