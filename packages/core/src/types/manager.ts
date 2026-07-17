import { EventEmitter } from 'events';
import { type Injection, type UIInjector } from './ui';
import { type EffectRegistry } from '../effect';
import { type Logger } from './log';
import { type MediaScanner } from './scanner/scanner';
import { type DirectoryManager } from './scanner/dir';
import { type CGServer } from './server';
import { type PluginManager } from './plugin';
import { type CasparProcess } from './caspar/process';
import { type CasparExecutor } from './caspar/executor';
import { type FileDatabase } from './scanner/db';
import { type RundownManager } from './rundown';
import { type VideoRoutesManager } from './routes';
import {
    type ActionDefinition,
    type ActionHandle,
    type FeedbackDefinition,
    type FeedbackHandle,
    type OptionValues,
    type InvokeContext,
} from './companion';
import {
    type ServiceHandle,
    type ContributionHandle,
    type Contribution,
} from './interop';

export declare class PluginInterop {
    provideService<T>(name: string, impl: T, owner: string): ServiceHandle<T>;
    getService<T>(name: string): T | null;
    awaitService<T>(name: string, owner: string): Promise<T>;
    onServiceChange(handler: (name: string) => void): void;
    offServiceChange(handler: (name: string) => void): void;

    contribute<T>(
        point: string,
        value: T,
        owner: string,
    ): ContributionHandle<T>;
    getContributions<T>(point: string): Contribution<T>[];
    onContributionsChange(
        point: string,
        handler: (contributions: Contribution[]) => void,
    ): void;
    offContributionsChange(
        point: string,
        handler: (contributions: Contribution[]) => void,
    ): void;

    unregisterOwner(owner: string): void;
}

export declare class CompanionRegistry {
    registerAction(def: ActionDefinition, owner: string): ActionHandle;
    registerFeedback(def: FeedbackDefinition, owner: string): FeedbackHandle;
    invoke(
        plugin: string,
        id: string,
        options: OptionValues,
        ctx: InvokeContext,
    ): Promise<void>;
    subscribe(
        instanceId: string,
        plugin: string,
        id: string,
        options: OptionValues,
    ): void;
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
    public interop: PluginInterop;

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
