export interface TelemetryConfig {
    dsn: string | null;
    environment: string;
    replays: boolean;
    'sample-rate': number;
}

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
    'caspar-auto-restart': boolean;
    telemetry: TelemetryConfig;
}

// This module's default export is the only thing packaging cares about:
// `.lappis/scripts/package.js`'s `packageConfig()` overwrites the compiled
// `dist/util/_config.js` wholesale with `config.prod.json`, so a packaged
// build never runs `buildDefaults()` below. Keep this file to types + the
// default value — schema, CLI introspection and the dotted-path helpers
// live in `./configSchema`, which packaging does not touch.
import { buildDefaults } from './configSchema';

export default buildDefaults();
