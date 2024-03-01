import { EventEmitter } from 'events';

export declare class CasparProcess extends EventEmitter {
    start(): Promise<void>;
    stop(): Promise<void>;
    restart(): Promise<void>;

    get running(): boolean;
    getStatus(): { running: boolean };

    appendLog(data: string): void;
    getLogs(): string;
    get log(): string;
}