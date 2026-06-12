export interface Config {
    'hide-debug': boolean; // Hide debug messages
    'pipe-caspar': boolean; // Pipe CasparCG output to console
    port: number; // Port to listen on
    'log-dir'?: string | null; // Directory to store logs in
    dev: boolean; // Whether the server is in development mode
    web: boolean; // Whether to serve the Next.js web interface
    'caspar-path'?: string | null; // Path to CasparCG
    temp?: true; // Whether this config is temporary from dev mode
    'db-file': string; // Path to the database file
    'rundown-dir'?: string; // Directory to store rundowns in
    'routes-dir': string; // Directory to store routes in
    'plugins-dir': string; // Directory to load external plugins from
    'plugin-state-file': string; // Path to the persisted plugin-enabled-state file
    // Shared password for the web UI / API. `null` disables auth entirely —
    // anyone reachable on the network can poke at the manager. Set to a
    // string to require that operators present it (via the login screen,
    // which then sets a session cookie).
    password?: string | null;
    // Static API token for headless clients (e.g. Companion modules) that
    // cannot do cookie-based auth. When set, requests bearing
    // `Authorization: Bearer <token>` are accepted. Can be set alongside or
    // instead of `password`. If set without a `password`, the web UI login
    // page will not be usable.
    'api-token'?: string | null;
    // STUN server for WebRTC preview ICE gathering, e.g. "stun:stun.l.google.com:19302".
    // Required when clients connect from outside the local network (port-forwarded setup).
    // Leave unset for LAN-only use — skipping STUN makes preview sessions start instantly.
    'preview-stun'?: string | null;
}

export default {
    dev: process.env.NODE_ENV !== 'production',
    web: true,
    'hide-debug': process.env.NODE_ENV === 'production',
    port: 5353,
    'log-dir': null,
    'pipe-caspar': false,
    'caspar-path': null,
    temp: true,
    'db-file': './media-cache.json',
    'rundown-dir': './rundowns',
    'routes-dir': './routes',
    'plugins-dir': './plugins',
    'plugin-state-file': './plugin-state.json',
    password: null,
} as Config;
