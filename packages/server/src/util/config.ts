import path from 'path';
import { promises as fs } from 'fs';
import { noTry, noTryAsync } from 'no-try';
import { Logger } from './log';

export type { Config } from './_config';
import config from './_config';
import { configuration } from '../manager/config';

type LoadOutcome = 'loaded' | 'missing' | 'failed';

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);

/** `JSON.parse` happily produces an own `"__proto__"` property (it assigns
 *  keys directly, it doesn't invoke the setter), but reading `obj['__proto__']`
 *  back off a normal object *does* hit the inherited accessor and returns the
 *  real prototype — so an unguarded recursive merge of config.json content
 *  can walk straight into `Object.prototype`. Same hazard for `constructor`. */
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** One-level-aware recursive merge of plain objects. `Object.assign` is
 *  shallow, so overlaying `{"telemetry":{"dsn":"..."}}` from config.json
 *  would otherwise replace the whole nested `telemetry` default and wipe its
 *  siblings. Arrays and `null` replace wholesale — config has no array-valued
 *  keys, and `null` is a meaningful "unset" value (e.g. telemetry.dsn). */
function deepAssign<T extends object>(target: T, source: object): T {
    const targetRecord = target as Record<string, unknown>;
    Object.entries(source).forEach(([key, value]) => {
        if (UNSAFE_KEYS.has(key)) return;
        if (isPlainObject(value) && isPlainObject(targetRecord[key]))
            deepAssign(targetRecord[key], value);
        else targetRecord[key] = value;
    });
    return target;
}

async function readConfigFile(configPath: string): Promise<LoadOutcome> {
    const [readErr, raw] = await noTryAsync(() =>
        fs.readFile(configPath, 'utf8'),
    );
    if (readErr) {
        if ((readErr as NodeJS.ErrnoException).code === 'ENOENT')
            return 'missing';
        Logger.error(
            `Failed to read config (${readErr.message}); keeping existing file untouched.`,
        );
        return 'failed';
    }

    const [parseErr, parsed] = noTry(() => JSON.parse(raw));
    if (parseErr) {
        Logger.error(
            `Failed to parse config (${parseErr.message}); keeping existing file untouched.`,
        );
        return 'failed';
    }

    deepAssign(config, parsed);
    return 'loaded';
}

/** Overlay config.json onto defaults without any logging, directory creation,
 *  or log-file side effects. For CLI commands that run outside the server. */
export async function loadConfigQuiet(): Promise<void> {
    await readConfigFile(path.join(process.cwd(), 'config.json'));
}

export async function loadConfig() {
    const configPath = path.join(process.cwd(), 'config.json');

    const temp = config.temp;
    delete config.temp;

    const outcome = await readConfigFile(configPath);
    const loaded = outcome === 'loaded';

    if (temp)
        Logger.info(
            loaded ? 'Loaded external config' : 'Loaded default config',
        );
    else
        Logger.info(
            loaded
                ? 'Loaded config'
                : 'Failed to load config, using default config',
        );

    if (config['caspar-path']) configuration.setPath(config['caspar-path']);

    // Only seed defaults when the file is genuinely missing. Never overwrite a file
    // we couldn't read or parse — that's almost always a transient error.
    if (outcome === 'missing') {
        const configString = JSON.stringify(config, null, 2);
        await fs
            .writeFile(configPath, configString, 'utf8')
            .then(() => Logger.info('Wrote default config'))
            .catch(() => Logger.error('Failed to write default config!'));
    }

    const directories = [];
    if (config['log-dir']) directories.push(config['log-dir']);
    if (config['rundown-dir']) directories.push(config['rundown-dir']);
    if (config['routes-dir']) directories.push(config['routes-dir']);
    if (config['plugins-dir']) directories.push(config['plugins-dir']);

    await Promise.all(
        directories.map(directory => fs.mkdir(directory, { recursive: true })),
    ).catch(() => Logger.error('Failed to create directories!'));

    if (config['log-dir'])
        await fs
            .writeFile(path.join(config['log-dir'], 'current.log'), '', 'utf8')
            .then(() => true)
            .catch(() => Logger.warn('Failed to reset log file!'));

    Logger['enableConsole']();
    Logger['doLogToFile'] = true;
    Logger['flushLogs']();
}

export default config;
