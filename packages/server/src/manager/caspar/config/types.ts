import { type schemas, type ArtnetData } from './schemas';

export interface Transform<T> {
    parse: (value: any) => T;
    serialize: (value: T) => any;
}

export interface Consumers {
    decklink: typeof schemas.decklink;
    bluefish: typeof schemas.bluefish;
    'system-audio': (typeof schemas)['system-audio'];
    screen: (typeof schemas)['screen'];
    ndi: (typeof schemas)['ndi'];
    ffmpeg: (typeof schemas)['ffmpeg'];
    artnet: ArtnetData;
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

export type LogLevel =
    'trace' | 'debug' | 'info' | 'warning' | 'error' | 'fatal';

export interface Config {
    version: string;
    videoModes: ConfigVideoMode[];
    channels: ConfigChannel[];
    logLevel?: LogLevel;
    html?: {
        remoteDebuggingPort?: number;
        enableGpu?: boolean;
    };
}

export interface Capabilities {
    artnet: 'legacy' | 'v2';
    // Native CasparCG edgeblend config support (gated on capability flag for
    // when the CasparCG edgeblend PR lands). The route-effect edgeblend in
    // src/plugins/internal/edgeblend/ is unrelated and always available.
    edgeblend: boolean;
}
