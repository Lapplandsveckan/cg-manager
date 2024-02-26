export interface Config {
    'hide-debug': boolean; // Hide debug messages
    'pipe-caspar': boolean; // Pipe CasparCG output to console
    'port': number; // Port to listen on
    'log-dir'?: string | null; // Directory to store logs in
    'dev': boolean; // Whether the server is in development mode
    'caspar-path'?: string | null; // Path to CasparCG
    'temp'? : true; // Whether this config is temporary from dev mode
    'db-file': string; // Path to the database file
}

export default {
    'dev': process.env.NODE_ENV !== 'production',
    'hide-debug': process.env.NODE_ENV === 'production',
    'port': 5353,
    'log-dir': null,
    'pipe-caspar': false,
    'caspar-path': null,
    'temp': true,
    'db-file': './media.json',
} as Config;