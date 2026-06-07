import fs from 'fs';
import path from 'path';
import { noTry } from 'no-try';
import { type CasparPlugin } from '@lappis/cg-manager';
import { Logger } from '../util/log';

export function loadPluginFolder(dir: string) {
    const logger = Logger.scope('Plugin Loader');

    const [readErr, entries] = noTry(() => fs.readdirSync(dir));
    if (readErr) {
        if (!readErr.message.includes('ENOENT'))
            // TODO: better way to check for ENOENT code
            logger.error(
                `Failed to read plugin folder ${dir}: ${Logger.formatError(readErr)}`,
            );
        return [];
    }

    const plugins: (typeof CasparPlugin)[] = [];
    for (const entry of entries) {
        if (entry.includes('.')) continue; // TODO: better way to check if folder

        const pluginPath = path.join(dir, entry);
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const [err, mod] = noTry(() => require(pluginPath));
        if (err) {
            logger.error(
                `Failed to load plugin "${entry}" from ${pluginPath}: ${Logger.formatError(err)}`,
            );
            continue;
        }

        const plugin = mod?.default as typeof CasparPlugin | undefined;
        if (!plugin) {
            logger.error(
                `Plugin "${entry}" at ${pluginPath} has no default export`,
            );
            continue;
        }

        plugins.push(plugin);
    }

    return plugins;
}
