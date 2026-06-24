export interface Config {
    'hide-debug': boolean;
    'pipe-caspar': boolean;
    port: number;
    'log-dir'?: string | null;
    dev: boolean;
    web: boolean;
    'caspar-path'?: string | null;
    temp?: true;
    'db-file': string;
    'rundown-dir'?: string;
    'routes-dir': string;
    'plugins-dir': string;
    'plugin-state-file': string;
    password?: string | null;
    'api-token'?: string | null;
    'preview-stun'?: string | null;
    host?: string | null;
    'socket-path'?: string | null;
    'caspar-profile'?: string;
}

const isDev = process.env.NODE_ENV !== 'production';

export interface FieldMeta {
    type: 'string' | 'number' | 'boolean';
    default: string | number | boolean | null;
    desc: string;
    /** false = documented but not written into a freshly-seeded config.json */
    seeded?: boolean;
    /** value is redacted in `manager config show` */
    secret?: boolean;
}

export const schema: Record<keyof Omit<Config, 'temp'>, FieldMeta> = {
    port: {
        type: 'number',
        default: 5353,
        desc: 'TCP port for the API + web UI.',
    },
    host: {
        type: 'string',
        default: null,
        desc: 'Interface/IP to bind to. null = all interfaces; "127.0.0.1" = loopback only.',
    },
    'socket-path': {
        type: 'string',
        default: null,
        desc: 'Unix socket / Windows named pipe to listen on instead of TCP. Takes precedence over host/port.',
    },
    web: {
        type: 'boolean',
        default: true,
        desc: 'Serve the Next.js web UI. false = API-only (web routes 404).',
    },
    dev: {
        type: 'boolean',
        default: isDev,
        desc: 'Development mode (affects crash handling).',
    },
    'hide-debug': {
        type: 'boolean',
        default: !isDev,
        desc: 'Hide debug log messages.',
    },
    'pipe-caspar': {
        type: 'boolean',
        default: false,
        desc: 'Pipe CasparCG stdout into the manager console as debug logs.',
    },
    'caspar-path': {
        type: 'string',
        default: null,
        desc: 'Path to the CasparCG installation directory.',
    },
    'log-dir': {
        type: 'string',
        default: null,
        desc: 'Directory for log files. null = no file logging.',
    },
    'db-file': {
        type: 'string',
        default: './media-cache.json',
        desc: 'Path to the media-cache database file.',
    },
    'rundown-dir': {
        type: 'string',
        default: './rundowns',
        desc: 'Directory for rundown files.',
    },
    'routes-dir': {
        type: 'string',
        default: './routes',
        desc: 'Directory for video route files.',
    },
    'plugins-dir': {
        type: 'string',
        default: './plugins',
        desc: 'Directory external plugins load from.',
    },
    'plugin-state-file': {
        type: 'string',
        default: './plugin-state.json',
        desc: 'Path to the persisted plugin enabled/disabled state.',
    },
    password: {
        type: 'string',
        default: null,
        secret: true,
        desc: 'Shared web UI / API password. null disables auth entirely.',
    },
    'api-token': {
        type: 'string',
        default: null,
        secret: true,
        seeded: false,
        desc: 'Static bearer token for headless clients. Coexists with or replaces password.',
    },
    'preview-stun': {
        type: 'string',
        default: null,
        seeded: false,
        desc: 'STUN server URL for WebRTC preview ICE. Leave unset for LAN-only use.',
    },
    'caspar-profile': {
        type: 'string',
        default: 'upstream',
        desc: 'CasparCG build profile. Valid values: "upstream" (stock CasparCG) or "lappis" (Lappis custom builds). Controls which config schema variants and feature flags are active.',
    },
};

export default {
    ...Object.fromEntries(
        Object.entries(schema)
            .filter(([, m]) => m.seeded !== false)
            .map(([k, m]) => [k, m.default]),
    ),
    temp: true,
} as Config;
