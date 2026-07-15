import { EventEmitter } from 'events';

export interface CasparStatus {
    running: boolean;
    supported: boolean;
    lastError: string | null;
}

export declare class CasparProcess extends EventEmitter {
    start(): Promise<void>;
    stop(): Promise<void>;
    restart(): Promise<void>;

    get running(): boolean;
    getStatus(): CasparStatus;

    appendLog(data: string): void;
    getLogs(): string;
    get log(): string;

    public get casparPath(): string;
}
