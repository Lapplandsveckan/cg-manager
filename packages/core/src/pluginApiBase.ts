import { EventEmitter } from 'events';
import { pluginDataDir, pluginTempDir, resolveInside } from './pluginDirs';
import { type Effect } from './effect';
import { type Channel } from './layers';
import { type CasparManager } from './types';
import {
    type Rundown,
    type RundownActionMetadata,
    type RundownItem,
} from './types/rundown';
import { type CasparStatus } from './types/caspar/process';
import { type IngestApi } from './types/ingest';
import { pluginIngestApi, type PluginIngest } from './ingestApi';
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
import { type CasparPlugin } from './plugin';

/** Everything a plugin only ever *asks* the host for. The registrations a
 *  plugin has to have undone when it is disabled live on `PluginAPI` itself,
 *  next to the bookkeeping that undoes them. */
export abstract class PluginApiBase extends EventEmitter {
    protected readonly _manager: CasparManager;
    protected readonly _plugin: CasparPlugin;

    public constructor(_manager: CasparManager, _plugin: CasparPlugin) {
        super();

        this._manager = _manager;
        this._plugin = _plugin;
    }

    public onReconnect(handler: () => void) {
        this._manager.on('caspar-reconnect', handler);
    }

    public offReconnect(handler: () => void) {
        this._manager.off('caspar-reconnect', handler);
    }

    public onConnect(handler: () => void) {
        this._manager.on('caspar-connect', handler);
    }

    public offConnect(handler: () => void) {
        this._manager.off('caspar-connect', handler);
    }

    public getEffectGroup(name: string, index?: number) {
        return this._manager.executor.getEffectGroup(name, index);
    }

    // `options` mirrors `EffectRegistry.create`'s `Record<string, any>` (effect.ts)
    // — each effect type defines its own options shape, so tightening this
    // needs that coupling untangled first, not a local fix.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public createEffect<T = Effect>(name: string, group: string, options: any) {
        const effectGroup = this._manager.executor.getEffectGroup(group);
        return this._manager.effects.create(name, effectGroup, options) as T;
    }

    public getEffect(id: string) {
        return this._manager.executor.getEffect(id);
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

    public getDataDir() {
        const root = this._manager.getPluginDataRoot();
        return pluginDataDir(root, this._plugin.pluginName);
    }

    public getDataPath(...segments: string[]) {
        return resolveInside(this.getDataDir(), segments);
    }

    public getTempDir() {
        return pluginTempDir(this._plugin.pluginName);
    }

    protected _ingest: PluginIngest | null = null;

    public get ingest(): IngestApi {
        this._ingest ??= pluginIngestApi(this._manager.ingest);
        return this._ingest.api;
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

    private _companionActions: ActionHandle[] = [];
    private _companionFeedbacks: FeedbackHandle[] = [];

    protected unregisterCompanion() {
        this._manager.companion.unregisterOwner(this._plugin.pluginName);
        this._companionActions = [];
        this._companionFeedbacks = [];
    }

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

    public getChannel(casparChannel: number): Channel {
        return this._manager.executor.getChannel(casparChannel);
    }

    public getRundown(id: string): Rundown | null {
        return this._manager.rundowns.getRundown(id);
    }

    public getRundowns(): Rundown[] {
        return this._manager.rundowns.getRundowns();
    }

    public createRundown(name: string): Rundown {
        return this._manager.rundowns.createRundown(name);
    }

    public deleteRundown(id: string): Promise<void> {
        return this._manager.rundowns.deleteRundown(id);
    }

    public getCasparStatus(): CasparStatus {
        return this._manager.caspar.getStatus();
    }

    public onCasparStatus(handler: (status: CasparStatus) => void) {
        this._manager.on('caspar-status', handler);
    }

    public offCasparStatus(handler: (status: CasparStatus) => void) {
        this._manager.off('caspar-status', handler);
    }

    public isConnected(): boolean {
        return this._manager.executor.connected;
    }

    public awaitConnection(): Promise<void> {
        return this._manager.executor.awaitConnection();
    }

    public onMediaChange(handler: (key: string, value: unknown) => void) {
        this._manager.on('media', handler);
    }

    public offMediaChange(handler: (key: string, value: unknown) => void) {
        this._manager.off('media', handler);
    }

    /** Services are named in-process objects other plugins look up by string name, never by importing the provider class. */
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

    /** Extension points are the inverse of a service: a provider declares a named point and consumers push contributions into it. */
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
