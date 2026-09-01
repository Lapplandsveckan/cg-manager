import { type schemas, type ArtnetData } from './schemas';

// xml2js parses every element as `{ [tag]: child[] }`, with the child list
// always an array even for a singular element — hence the `[0]` indexing
// throughout parse.ts/build.ts.
export type XmlValue = string | XmlNode;
export type XmlNode = { [key: string]: XmlValue[] };

// `schema.array()` tags the array it returns with the wrapper element name
// (see schemas.ts) so the parse/serialize round-trip knows what to call it.
// An interface (rather than `T[] & {...}`) so it can appear in the recursive
// `SchemaNode` union below without TypeScript rejecting the self-reference.
export interface NamedArray<T> extends Array<T> {
    _name: string;
}

// The shape of a `schemas.ts` schema descriptor: primitives are sentinel
// values (`1`, `'string'`, `true`) indicating what to parse a leaf as, nested
// objects mirror the config shape, and arrays are always `NamedArray`s.
export type SchemaNode =
    | string
    | number
    | boolean
    | { [key: string]: SchemaNode }
    | NamedArray<SchemaNode>;

export interface Transform<T> {
    parse: (value: unknown) => T;
    serialize: (value: T) => unknown;
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
