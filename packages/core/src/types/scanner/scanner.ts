import {FileDatabase} from './db';

export declare class MediaScanner {
    public started: boolean;

    start(): Promise<void>;
    stop(): Promise<void>;

    public getDatabase(): FileDatabase;
}