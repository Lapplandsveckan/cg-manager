export interface Config {
    'hide-debug': boolean; // Hide debug messages
    'pipe-caspar': boolean; // Pipe CasparCG output to console
    'port': number; // Port to listen on
    'log-dir'?: string | null; // Directory to store logs in
    'dev': boolean; // Whether the server is in development mode
    'caspar-path'?: string | null; // Path to CasparCG
    'temp'? : true; // Whether this config is temporary from dev mode
    'db-file': string; // Path to the database file
    'rundown-dir'?: string; // Directory to store rundowns in
    'routes-dir': string; // Directory to store routes in
    'plugin-state-file': string; // Path to the persisted plugin-enabled-state file
    // Shared password for the web UI / API. `null` disables auth entirely —
    // anyone reachable on the network can poke at the manager. Set to a
    // string to require that operators present it (via the login screen,
    // which then sets a session cookie).
    'password'?: string | null;
}

export default {
    'dev': process.env.NODE_ENV !== 'production',
    'hide-debug': process.env.NODE_ENV === 'production',
    'port': 5353,
    'log-dir': null,
    'pipe-caspar': false,
    'caspar-path': null,
    'temp': true,
    'db-file': './media-cache.json',
    'rundown-dir': './rundowns',
    'routes-dir': './routes',
    'plugin-state-file': './plugin-state.json',
    'password': null,
} as Config;