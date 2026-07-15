import { CommandExecutor } from '../../executor';
import { type Channel, type EffectGroup } from '../../layers';

export declare class CasparExecutor extends CommandExecutor {
    public readonly ip: string;
    public readonly port: number;

    // constructor will not be available from plugin
    // constructor(port?: number, ip?: string);
    private constructor(port?: number, ip?: string);

    public connect(): void;
    public disconnect(): void;
    public awaitConnection(): Promise<void>;

    public get connected(): boolean;
    public getChannel(casparChannel: number): Channel;
    public getChannels(): Channel[];
    public getEffectGroup(identifier: string, index?: number): EffectGroup;
}
