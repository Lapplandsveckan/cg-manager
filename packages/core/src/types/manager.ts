import {EventEmitter} from 'events';
import {Injection, UIInjector} from './ui';
import {EffectRegistry} from '../effect';
import {Logger} from './log';
import {MediaScanner} from './scanner/scanner';
import {DirectoryManager} from './scanner/dir';
import {CGServer} from './server';
import {PluginManager} from './plugin';
import {CasparProcess} from './caspar/process';
import {CasparExecutor} from './caspar/executor';
import {FileDatabase} from './scanner/db';
import {RundownManager} from './rundown';
import {VideoRoutesManager} from './routes';
import {ActionDefinition, ActionHandle, FeedbackDefinition, FeedbackHandle, OptionValues, InvokeContext} from './companion';

export declare class CompanionRegistry {
    registerAction(def: ActionDefinition, owner: string): ActionHandle;
    registerFeedback(def: FeedbackDefinition, owner: string): FeedbackHandle;
    invoke(plugin: string, id: string, options: OptionValues, ctx: InvokeContext): Promise<void>;
    subscribe(instanceId: string, plugin: string, id: string, options: OptionValues): void;
    unsubscribe(instanceId: string): void;
    invalidate(plugin: string, id: string): void;
    unregisterOwner(owner: string): void;
    listDefinitions(): { actions: unknown[]; feedbacks: unknown[] };
}

export declare class CasparManager extends EventEmitter {
    public effects: EffectRegistry;
    public ui: UIInjector;
    public scanner: MediaScanner;
    public server: CGServer;
    public plugins: PluginManager;
    public caspar: CasparProcess;
    public executor: CasparExecutor;
    public db: FileDatabase;
    public rundowns: RundownManager;
    public routes: VideoRoutesManager;
    public companion: CompanionRegistry;

    // This is a static method, so it will not be available from the plugin
    // public static getManager(): CasparManager;

    start(): Promise<void>;
    stop(): Promise<void>;

    public getMediaScanner(): MediaScanner;
    public get directory(): DirectoryManager;
    public getPlugins(): PluginManager;
    public getCasparProcess(): CasparProcess;
    public getExecutor(): CasparExecutor;
    public getFiles(): FileDatabase;

    public getPluginInjections(): Injection[];
    public getPluginInjectionCode(id: string): Promise<string>;

    public getLogger(scope: string): Logger;
}