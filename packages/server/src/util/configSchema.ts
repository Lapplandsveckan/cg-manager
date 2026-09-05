import { type Config } from './_config';

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

/** Dotted keys (`telemetry.dsn`) reach into nested config objects — the only
 *  nesting `Config` has. `schema` therefore can't stay `keyof Config`-checked;
 *  the dotted paths below are all that guards it.
 *
 *  This file — unlike `_config.ts` — is never touched by packaging.
 *  `.lappis/scripts/package.js`'s `packageConfig()` overwrites the compiled
 *  `dist/util/_config.js` wholesale with `config.prod.json`, on the
 *  assumption that `_config.ts` exports nothing but swappable default data.
 *  `schema` and the CLI machinery below are introspection logic, not
 *  defaults, so they live here instead — keeping that assumption true and
 *  keeping `manager config show/get/set/keys` working in packaged builds. */
export const schema: Record<string, FieldMeta> = {
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
    'caspar-auto-restart': {
        type: 'boolean',
        default: true,
        desc: 'Automatically respawn CasparCG (with backoff and a retry cap) when it exits unexpectedly, e.g. a crash. false = leave it down until manually restarted.',
    },
    'telemetry.dsn': {
        type: 'string',
        default: null,
        desc: 'Sentry DSN for error reporting, log breadcrumbs and session replay. null disables telemetry entirely.',
    },
    'telemetry.environment': {
        type: 'string',
        default: 'production',
        desc: 'Sentry environment tag (e.g. "production", "staging").',
    },
    'telemetry.replays': {
        type: 'boolean',
        default: true,
        desc: 'Capture a browser session replay alongside error reports. No effect without telemetry.dsn.',
    },
    'telemetry.sample-rate': {
        type: 'number',
        default: 1,
        desc: 'Fraction (0-1) of error events sent to Sentry — applies to both the server and the browser.',
    },
};

/** `__proto__`/`constructor`/`prototype` segments let a dotted path escape
 *  into the prototype chain instead of `target`'s own data — reject them
 *  outright rather than trying to path-traverse around them. */
const UNSAFE_PATH_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);
const isUnsafePath = (path: string): boolean =>
    path.split('.').some(part => UNSAFE_PATH_SEGMENTS.has(part));

/** Writes `value` at a dot-separated `path` into `target`, creating
 *  intermediate objects as needed. */
export function setPath(
    target: Record<string, unknown>,
    path: string,
    value: unknown,
): void {
    if (isUnsafePath(path)) return;
    const parts = path.split('.');
    const last = parts.pop() as string;
    const parent = parts.reduce((acc, part) => {
        const next = acc[part];
        if (typeof next !== 'object' || next === null) acc[part] = {};
        return acc[part] as Record<string, unknown>;
    }, target);
    parent[last] = value;
}

/** Reads the value at a dot-separated `path` from `target`. */
export function getPath(
    target: Record<string, unknown>,
    path: string,
): unknown {
    if (isUnsafePath(path)) return undefined;
    return path
        .split('.')
        .reduce<unknown>(
            (acc, part) =>
                typeof acc === 'object' && acc !== null
                    ? (acc as Record<string, unknown>)[part]
                    : undefined,
            target,
        );
}

/** True when a dot-separated `path` resolves to an own property in `target`. */
export function hasPath(
    target: Record<string, unknown>,
    path: string,
): boolean {
    if (isUnsafePath(path)) return false;
    const parts = path.split('.');
    const last = parts.pop() as string;
    const parent = parts.reduce<unknown>(
        (acc, part) =>
            typeof acc === 'object' && acc !== null
                ? (acc as Record<string, unknown>)[part]
                : undefined,
        target,
    );
    return (
        typeof parent === 'object' &&
        parent !== null &&
        Object.prototype.hasOwnProperty.call(parent, last)
    );
}

/** Builds the default config object from `schema`. Used by `_config.ts`'s
 *  `export default` in dev — packaging replaces that default wholesale with
 *  `config.prod.json`, so this never runs inside a packaged build. */
export function buildDefaults(): Config {
    return Object.entries(schema)
        .filter(([, m]) => m.seeded !== false)
        .reduce(
            (defaults, [key, meta]) => {
                setPath(defaults, key, meta.default);
                return defaults;
            },
            { temp: true } as Record<string, unknown>,
        ) as unknown as Config;
}
