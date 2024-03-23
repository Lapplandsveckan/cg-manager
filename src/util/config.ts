import path from 'path';
import {promises as fs} from 'fs';
import {Logger} from './log';

export type { Config } from './_config';
import config from './_config';

export async function loadConfig() {
    const configPath = path.join(process.cwd(), 'config.json');

    const temp = config.temp;
    delete config.temp;

    let configPromise = fs.readFile(configPath, 'utf8')
        .then((data) => JSON.parse(data))
        .then((parsed) => Object.assign(config, parsed));

    if (temp)
        configPromise = configPromise
            .then(() => Logger.info('Loaded external config'))
            .catch(() => Logger.info('Loaded default config'));
    else
        configPromise = configPromise
            .then(() => Logger.info('Loaded config'))
            .catch(() => Logger.warn('Failed to load config, using default config'));

    await configPromise;

    if (!temp) {
        const configString = JSON.stringify(config, null, 2);
        await fs.writeFile(configPath, configString, 'utf8')
            .then(() => Logger.info('Saved config'))
            .catch(() => Logger.error('Failed to save config!'));
    }

    const directories = [];
    if (config['log-dir']) directories.push(config['log-dir']);

    await Promise.all(directories.map(directory => fs.mkdir(directory, {recursive: true})))
        .catch(() => Logger.error('Failed to create directories!'));

    if (config['log-dir'])
        await fs.writeFile(path.join(config['log-dir'], 'current.log'), '', 'utf8')
            .then(() => true)
            .catch(() => Logger.warn('Failed to reset log file!'));

    Logger['enableConsole']();
    Logger['doLogToFile'] = true;
    Logger['flushLogs']();
}

export default config;