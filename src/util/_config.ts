export interface Config {
    'hide-debug': boolean; // Hide debug messages
    'port': number; // Port to listen on
    'log-dir'?: string | null; // Directory to store logs in
    'dev': boolean; // Whether the server is in development mode
    'caspar-path'?: string | null; // Path to CasparCG
    'temp'? : true; // Whether this config is temporary from dev mode
}

export default {
    'dev': process.env.NODE_ENV !== 'production',
    'hide-debug': process.env.NODE_ENV === 'production',
    'port': 5353,
    'log-dir': null,
    'caspar-path': null,
    'temp': true,
} as Config;