import {promises as fs} from 'fs';
import path from 'path';
import {Logger} from './log';

interface Config {
    'hide-debug': boolean; // Hide debug messages
}

const defaultConfig = {
    'hide-debug': process.env.NODE_ENV !== 'development',
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
}

export default config;