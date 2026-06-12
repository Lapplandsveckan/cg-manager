import path from 'path';
import { promises as fs } from 'fs';
import { noTry, noTryAsync } from 'no-try';
import { Logger } from './log';

export type { Config } from './_config';
import config from './_config';
import { configuration } from '../manager/config';

type LoadOutcome = 'loaded' | 'missing' | 'failed';

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

    Object.assign(config, parsed);
    return 'loaded';
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
