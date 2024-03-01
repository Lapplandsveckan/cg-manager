import {CasparPlugin} from '../plugin';

export declare class PluginManager {
    public register(plugin: typeof CasparPlugin): void;
    public unregister(plugin: CasparPlugin): void;

    public enableAll(): void;
    public disableAll(): void;

    public get plugins(): CasparPlugin[];
    public get enabled(): boolean;

    public broadcast(event: string, ...args: any[]): void;
}