import path from 'path';
import {promises as fs} from 'fs';
import {Logger} from './log';

interface Config {
    'hide-debug': boolean; // Hide debug messages
    'port': number; // Port to listen on
    'log-dir': string; // Directory to store logs in
}

const defaultConfig = {
    'hide-debug': process.env.NODE_ENV !== 'development',
    'port': 5353,
    'log-dir': './manager-logs',
} as Config;

const config = defaultConfig;
export async function loadConfig() {
    // TODO: load config from somewhere, below is an example from my old project

    // const configPath = path.join(process.cwd(), 'config.json');
    //
    // await fs.readFile(configPath, 'utf8')
    //     .then((data) => JSON.parse(data))
    //     .then((parsed) => Object.assign(config, parsed))
    //     .then(() => Logger.info('Loaded config'))
    //     .catch(() => Logger.warn('Failed to load config, using default config'));
    //
    // const configString = JSON.stringify(config, null, 2);
    // await fs.writeFile(configPath, configString, 'utf8')
    //     .catch(() => Logger.error('Failed to save config!'));

    const directories = [
        config['log-dir'],
    ];

    await Promise.all(directories.map(directory => fs.mkdir(directory, {recursive: true})))
        .catch(() => Logger.error('Failed to create directories!'));

    await fs.writeFile(path.join(config['log-dir'], 'current.log'), '', 'utf8')
        .then(() => true)
        .catch(() => Logger.warn('Failed to reset log file!'));

    Logger['doLogToFile'] = true;
    Logger['flushLogs']();
}

export default config;