import path from 'path';
import { promises as fs } from 'fs';
import { noTryAsync } from 'no-try';
import { Logger } from '../util/log';
import config from '../util/config';
import files from './_plugins';
import { loadPluginFolder } from './util';
import { extractCgPlugin, loadSinglePlugin, sweepTombstones } from './install';
import { CasparManager } from '../manager';
import { configuration } from '../manager/config';
import { Upload } from '../manager/scanner/upload';

export async function loadPlugins() {
    const logger = Logger.scope('Plugin Loader');
    logger.info('Loading plugins...');

    const pluginsDir = path.resolve(process.cwd(), config['plugins-dir']);
    await sweepTombstones(pluginsDir);
    const externalPlugins = loadPluginFolder(pluginsDir);

    // Wire the plugin-upload completion hook so uploaded .cgplugin zips are
    // extracted and hot-loaded without a restart.
    Upload.onPluginComplete = async (zipPath: string) => {
        try {
            const result = await extractCgPlugin(zipPath, pluginsDir);
            const manager = CasparManager.getManager();
            const pluginClass = loadSinglePlugin(result.dir);
            manager.getPlugins().installFromDir(result.dir, pluginClass);
            manager.emit('plugin-list-changed');
            logger.info(`Plugin "${result.name}" installed and enabled`);
        } finally {
            await noTryAsync(() => fs.rm(zipPath, { force: true }));
        }
    };

    await CasparManager.getManager().plugins.loadState();

    const cfg = await configuration.get();
    CasparManager.getManager().plugins.setChannelCount(
        cfg.channels?.length ?? 0,
    );

    for (const { plugin, dir } of files)
        CasparManager.getManager().plugins.register(plugin, dir, true);
    for (const { plugin, dir } of externalPlugins)
        CasparManager.getManager().plugins.register(plugin, dir);

    logger.info('Enabling plugins...');
    CasparManager.getManager().plugins.enableAll();
}

export function unloadPlugins() {
    Logger.scope('Plugin Loader').info('Unloading plugins...');
    CasparManager.getManager().plugins.disableAll();
}
