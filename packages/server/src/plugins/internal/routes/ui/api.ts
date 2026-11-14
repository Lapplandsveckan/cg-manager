import { type useSocket } from '@web-lib';

export interface DecklinkSource {
    type: 'decklink';
    device: number;
    format: string;
    keyDevice?: number;
}

export interface VideoSource {
    type: 'video';
    video: string;
}

export interface ChannelSource {
    type: 'channel';
    channel: number;
}

export interface ColorSource {
    type: 'color';
    color: string;
}

/** A source type another plugin contributed; its payload is that plugin's. */
export interface ContributedSource {
    type: string;
    [key: string]: unknown;
}

export type BuiltinSource =
    DecklinkSource | VideoSource | ChannelSource | ColorSource;

export type VideoRouteSource = BuiltinSource | ContributedSource;

export const BUILTIN_SOURCE_TYPES: BuiltinSource['type'][] = [
    'decklink',
    'video',
    'channel',
    'color',
];

export const isBuiltinSource = (
    source: VideoRouteSource,
): source is BuiltinSource =>
    BUILTIN_SOURCE_TYPES.includes(source.type as BuiltinSource['type']);

export interface RouteSourceTypeInfo {
    type: string;
    label: string;
    description?: string;
    plugin: string;
}

export interface VideoRouteDestination {
    type: 'effect-group';
    effectLayer: string;
    index?: number;
}

export interface VideoRoute {
    id: string;
    name: string;

    transform?: number[];
    edgeblend?: number[];
    perspective?: number[];

    source: VideoRouteSource;
    destination: VideoRouteDestination;

    enabled: boolean;
    metadata?: Record<string, unknown>;
}

type Connection = ReturnType<typeof useSocket>;

const PLUGIN_ROOT = '/api/plugin/routes';
const ROOT = `${PLUGIN_ROOT}/routes`;

const routePath = (id: string) => `${ROOT}/${encodeURIComponent(id)}`;

export const routesApi = {
    sourceTypes: async (conn: Connection) =>
        ((await conn.rawRequest(
            `${PLUGIN_ROOT}/source-types`,
            'GET',
            {},
        )) as RouteSourceTypeInfo[]) ?? [],

    list: async (conn: Connection) =>
        ((await conn.rawRequest(ROOT, 'GET', {})) as VideoRoute[]) ?? [],

    create: async (conn: Connection, data: Omit<VideoRoute, 'id'>) =>
        (await conn.rawRequest(ROOT, 'CREATE', data)) as VideoRoute,

    get: async (conn: Connection, id: string) =>
        (await conn.rawRequest(routePath(id), 'GET', {})) as VideoRoute,

    delete: async (conn: Connection, id: string) => {
        await conn.rawRequest(routePath(id), 'DELETE', {});
    },

    update: async (conn: Connection, id: string, patch: Partial<VideoRoute>) =>
        (await conn.rawRequest(routePath(id), 'UPDATE', patch)) as VideoRoute,

    setEnabled: async (conn: Connection, id: string, enabled: boolean) =>
        (await conn.rawRequest(
            `${routePath(id)}/${enabled ? 'enable' : 'disable'}`,
            'ACTION',
            {},
        )) as VideoRoute,
};
