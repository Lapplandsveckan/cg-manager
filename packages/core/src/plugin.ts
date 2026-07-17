import { EventEmitter } from 'events';
import { noTry } from 'no-try';
import {
    type Method,
    type WebsocketOutboundMethod,
} from 'rest-exchange-protocol';
import { type Route } from 'rest-exchange-protocol/dist/route';
import { type Effect, type EffectConstructor } from './effect';
import { type Channel } from './layers';
import { type Logger, type CasparManager } from './types';
import { type UI_INJECTION_ZONE_KEY } from './types/ui';
import {
    type RundownActionMetadata,
    type RundownItem,
    type Rundown,
} from './types/rundown';
import { type VideoRoute, type RouteChange } from './types/routes';
import { type CasparStatus } from './types/caspar/process';
import {
    type ActionDefinition,
    type ActionHandle,
    type FeedbackDefinition,
    type FeedbackHandle,
} from './types/companion';
import {
    type ServiceHandle,
    type ContributionHandle,
    type Contribution,
} from './types/interop';

export class CasparPlugin {
    private _api: PluginAPI;
    private _enabled: boolean = false;
    protected logger: Logger;

    // Optional static hooks, read reflectively by the host (like
    // `minChannels` — not declared here so plugins aren't forced to extend a
    // constructor):
    //   static dependencies = ['other-plugin'];          // hard: gates enable
    //   static optionalDependencies = ['nice-to-have'];   // soft: orders only

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

    protected onEnable() {}

    protected onDisable() {}

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
        this._plugin['logger'] = _manager
            .getLogger('Plugin')
            .scope(this._plugin.pluginName);
    }

    public onReconnect(handler: () => void) {
        this._manager.on('caspar-reconnect', handler);
    }

    public offReconnect(handler: () => void) {
        this._manager.off('caspar-reconnect', handler);
    }

    private _effects: string[] = [];
    private routes: Route[] = [];
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

    private _companionActions: ActionHandle[] = [];
    private _companionFeedbacks: FeedbackHandle[] = [];

    private unregisterCompanion() {
        this._manager.companion.unregisterOwner(this._plugin.pluginName);
        this._companionActions = [];
        this._companionFeedbacks = [];
    }

    private unregister() {
        this.unregisterEffects();
        this.unregisterRoutes();
        this.unregisterUIInjections();
        this.unregisterCompanion();
        this._manager.interop.unregisterOwner(this._plugin.pluginName);
        return this.unregisterFiles();
    }

    public registerRoute(
        path: string,
        handler: Route['handler'],
        method: Method,
    ) {
        const route = this._manager.server.registerRoute(
            `plugin/${this._plugin.pluginName}/${path}`,
            handler,
            method,
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

    public broadcast(
        target: string,
        method: WebsocketOutboundMethod,
        data: any,
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
     * The absolute path to CasparCG's media root directory, e.g. to write
     * generated files into it directly instead of going through uploads.
     */
    public getMediaRoot() {
        return this._manager.getMediaScanner().mediaRoot;
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

    public createEffect<T = Effect>(name: string, group: string, options: any) {
        const effectGroup = this._manager.executor.getEffectGroup(group);
        return this._manager.effects.create(name, effectGroup, options) as T;
    }

    public getEffect(id: string) {
        return this._manager.executor.getEffect(id);
    }

    public registerRundownAction(
        name: string,
        handler: (item: RundownItem) => Promise<void> | void,
        metadata?: RundownActionMetadata,
    ) {
        this._manager.rundowns.executor.registerAction(
            name,
            handler,
            this._plugin.pluginName,
            metadata,
        );
    }

    // Companion surface — actions & feedbacks

    public registerAction(def: ActionDefinition): ActionHandle {
        const handle = this._manager.companion.registerAction(
            def,
            this._plugin.pluginName,
        );
        this._companionActions.push(handle);
        return handle;
    }

    public registerFeedback(def: FeedbackDefinition): FeedbackHandle {
        const handle = this._manager.companion.registerFeedback(
            def,
            this._plugin.pluginName,
        );
        this._companionFeedbacks.push(handle);
        return handle;
    }

    public invalidateFeedback(id: string): void {
        this._manager.companion.invalidate(this._plugin.pluginName, id);
    }

    // Video routes — read
    public getVideoRoute(id: string): VideoRoute | null {
        return this._manager.routes.getVideoRoute(id);
    }

    public getVideoRoutes(): VideoRoute[] {
        return this._manager.routes.getVideoRoutes();
    }

    // Video routes — write
    public createVideoRoute(data: Omit<VideoRoute, 'id'>): VideoRoute {
        return this._manager.routes.createVideoRoute(data);
    }

    public updateVideoRoute(data: VideoRoute): Promise<void> {
        return this._manager.routes.updateVideoRoute(data);
    }

    public deleteVideoRoute(id: string): Promise<void> {
        return this._manager.routes.deleteVideoRoute(id);
    }

    public setVideoRouteEnabled(id: string, enabled?: boolean) {
        const value =
            enabled ?? !this._manager.routes.getVideoRoute(id)?.enabled;
        this._manager.routes.setVideoRouteEnabled(id, value);
    }

    // Channel access
    public getChannel(casparChannel: number): Channel {
        return this._manager.executor.getChannel(casparChannel);
    }

    // Rundowns — read
    public getRundown(id: string): Rundown | null {
        return this._manager.rundowns.getRundown(id);
    }

    public getRundowns(): Rundown[] {
        return this._manager.rundowns.getRundowns();
    }

    // Rundowns — write
    public createRundown(name: string): Rundown {
        return this._manager.rundowns.createRundown(name);
    }

    public deleteRundown(id: string): Promise<void> {
        return this._manager.rundowns.deleteRundown(id);
    }

    // CasparCG process status
    public getCasparStatus(): CasparStatus {
        return this._manager.caspar.getStatus();
    }

    public onCasparStatus(handler: (status: CasparStatus) => void) {
        this._manager.on('caspar-status', handler);
    }

    public offCasparStatus(handler: (status: CasparStatus) => void) {
        this._manager.off('caspar-status', handler);
    }

    // AMCP connection state
    public isConnected(): boolean {
        return this._manager.executor.connected;
    }

    public awaitConnection(): Promise<void> {
        return this._manager.executor.awaitConnection();
    }

    // Media library events
    public onMediaChange(handler: (key: string, value: unknown) => void) {
        this._manager.on('media', handler);
    }

    public offMediaChange(handler: (key: string, value: unknown) => void) {
        this._manager.off('media', handler);
    }

    // Route change events
    public onRouteChange(handler: (change: RouteChange) => void) {
        this._manager.on('route-change', handler);
    }

    public offRouteChange(handler: (change: RouteChange) => void) {
        this._manager.off('route-change', handler);
    }

    // Inter-plugin services — a named, in-process object another plugin can
    // look up and call directly. Loosely coupled: consumers address the
    // provider by string name only, never by importing its class.
    public provideService<T>(name: string, impl: T): ServiceHandle<T> {
        return this._manager.interop.provideService(
            name,
            impl,
            this._plugin.pluginName,
        );
    }

    public getService<T>(name: string): T | null {
        return this._manager.interop.getService(name);
    }

    /** Resolves once a service with this name is provided (now or later). */
    public awaitService<T>(name: string): Promise<T> {
        return this._manager.interop.awaitService(
            name,
            this._plugin.pluginName,
        );
    }

    public onServiceChange(handler: (name: string) => void) {
        this._manager.interop.onServiceChange(handler);
    }

    public offServiceChange(handler: (name: string) => void) {
        this._manager.interop.offServiceChange(handler);
    }

    // Inter-plugin extension points — the inverse of a service: a provider
    // declares a named point and consumers push contributions into it.
    public contribute<T>(point: string, value: T): ContributionHandle<T> {
        return this._manager.interop.contribute(
            point,
            value,
            this._plugin.pluginName,
        );
    }

    public getContributions<T>(point: string): Contribution<T>[] {
        return this._manager.interop.getContributions(point);
    }

    public onContributionsChange(
        point: string,
        handler: (contributions: Contribution[]) => void,
    ) {
        this._manager.interop.onContributionsChange(point, handler);
    }

    public offContributionsChange(
        point: string,
        handler: (contributions: Contribution[]) => void,
    ) {
        this._manager.interop.offContributionsChange(point, handler);
    }
}
