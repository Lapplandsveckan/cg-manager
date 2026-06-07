import path from 'path';
import { Logger } from '../util/log';
import files from './_plugins';
import { loadPluginFolder } from './util';
import { CasparManager } from '../manager';

export async function loadPlugins() {
    const logger = Logger.scope('Plugin Loader');
    logger.info('Loading plugins...');

    const externalPlugins = loadPluginFolder(
        path.join(process.cwd(), 'plugins'),
    );
    const plugins = files.concat(externalPlugins);

    await CasparManager.getManager().plugins.loadState();
    for (const plugin of plugins)
        CasparManager.getManager().plugins.register(plugin);

    logger.info('Enabling plugins...');
    CasparManager.getManager().plugins.enableAll();
}

export function unloadPlugins() {
    Logger.scope('Plugin Loader').info('Unloading plugins...');
    CasparManager.getManager().plugins.disableAll();
}
