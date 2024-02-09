import {Logger} from '../util/log';
import files from './_plugins';
import path from 'path';
import {loadPluginFolder} from './util';
import {CasparManager} from '../manager';

export function loadPlugins() {
    const logger = Logger.scope('API');
    logger.info('Loading plugins...');

    const externalPlugins = loadPluginFolder(path.join(process.cwd(), 'plugins'));
    const plugins = files.concat(externalPlugins);
    for (const plugin of plugins) CasparManager.getManager().plugins.register(plugin);

    logger.info('Enabling plugins...');
    CasparManager.getManager().plugins.enableAll();
}