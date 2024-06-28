import {schemas} from './schemas';

export interface Transform<T> {
    parse: (value: any) => T;
    serialize: (value: T) => any;
}

export interface Consumers {
    decklink: typeof schemas.decklink;
    bluefish: typeof schemas.bluefish;
    'system-audio': typeof schemas['system-audio'];
    screen: typeof schemas['screen'];
    ndi: typeof schemas['ndi'];
    ffmpeg: typeof schemas['ffmpeg'];
    artnet: typeof schemas['artnet'];
}

type Consumer = {
    type: string;
    data: Consumers[keyof Consumers];
};

export interface ConfigChannel {
    videoMode: string;
    consumers: Consumer[];
}

export interface ConfigVideoMode {
    id: string;
    width: number;
    height: number;
    timeScale: number;
    duration: number;
    cadence: number;
}

export interface Config {
    version: string;
    videoModes: ConfigVideoMode[];
    channels: ConfigChannel[];
    html?: {
        remoteDebuggingPort?: number;
        enableGpu?: boolean;
    }

    _raw?: string;
}