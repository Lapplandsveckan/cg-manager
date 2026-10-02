import path from 'path';
import { promises as fs } from 'fs';
import { noTry, noTryAsync } from 'no-try';
import { Logger } from '../util/log';
import config from '../util/config';
import files from './_plugins';
import { extractCgPlugin, loadSinglePlugin, sweepTombstones } from './install';
import {
    listPluginFolders,
    migrateFlatLayout,
    resolveActiveVersion,
} from './versions';
import { CasparManager } from '../manager';
import { configuration } from '../manager/config';
import { Upload } from '../manager/scanner/upload';

export async function loadPlugins() {
    const logger = Logger.scope('Plugin Loader');
    logger.info('Loading plugins...');

    const pluginsDir = path.resolve(process.cwd(), config['plugins-dir']);
    await sweepTombstones(pluginsDir);
    await migrateFlatLayout(pluginsDir);

    const installPlugin = async (zipPath: string) => {
        const result = await extractCgPlugin(zipPath, pluginsDir);
        const manager = CasparManager.getManager();
        await manager
            .getPlugins()
            .versions.setActiveVersion(result.name, result.version);
        manager.emit('plugin-list-changed');
        logger.info(
            `Plugin "${result.name}" v${result.version} installed and activated`,
        );
    };

    Upload.onPluginComplete = async (zipPath: string) => {
        const [err] = await noTryAsync(() => installPlugin(zipPath));
        await noTryAsync(() => fs.rm(zipPath, { force: true }));
        if (err) throw err;
    };

    await CasparManager.getManager().plugins.loadState();

    const cfg = await configuration.get();
    CasparManager.getManager().plugins.setChannelCount(
        cfg.channels?.length ?? 0,
    );

    for (const { plugin, dir } of files)
        CasparManager.getManager().plugins.register(plugin, dir, true);

    const active = CasparManager.getManager().plugins.getActiveMap();
    const externalFolders = await listPluginFolders(pluginsDir);
    for (const folderName of externalFolders) {
        const resolved = await resolveActiveVersion(
            pluginsDir,
            folderName,
            active,
        );
        if (!resolved) continue;

        const [err, pluginClass] = noTry(() => loadSinglePlugin(resolved.dir));
        if (err) {
            logger.error(
                `Failed to load plugin "${folderName}" from ${resolved.dir}: ${Logger.formatError(err)}`,
            );
            continue;
        }

        CasparManager.getManager().plugins.register(pluginClass, resolved.dir);
    }

    logger.info('Enabling plugins...');
    CasparManager.getManager().plugins.enableAll();
}

export function unloadPlugins() {
    Logger.scope('Plugin Loader').info('Unloading plugins...');
    CasparManager.getManager().plugins.disableAll();
}
