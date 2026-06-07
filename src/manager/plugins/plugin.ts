import fs from 'fs/promises';
import { type CasparPlugin, PluginAPI } from '@lappis/cg-manager';
import { noTry, noTryAsync } from 'no-try';
import { Logger } from '../../util/log';
import config from '../../util/config';
import { CasparManager } from '../index';

export class PluginManager {
    private _plugins: CasparPlugin[] = [];
    private _disabled: Set<string> = new Set();

    public async loadState() {
        const file = config['plugin-state-file'];
        if (!file) return;

        const logger = Logger.scope('Plugin Loader');
        const [readErr, raw] = await noTryAsync(() =>
            fs.readFile(file, 'utf8'),
        );
        if (readErr) {
            if ((readErr as NodeJS.ErrnoException).code !== 'ENOENT')
                logger.error(
                    `Failed to read plugin state: ${Logger.formatError(readErr)}`,
                );
            return;
        }

        const [parseErr, parsed] = noTry(() => JSON.parse(raw));
        if (parseErr) {
            logger.error(
                `Failed to parse plugin state: ${Logger.formatError(parseErr)}`,
            );
            return;
        }

        const disabled = Array.isArray(parsed?.disabled)
            ? parsed.disabled.filter(
                  (n: unknown): n is string => typeof n === 'string',
              )
            : [];
        this._disabled = new Set(disabled);
    }

    private async saveState() {
        const file = config['plugin-state-file'];
        if (!file) return;

        const content = JSON.stringify(
            { disabled: [...this._disabled].sort() },
            null,
            2,
        );
        const [err] = await noTryAsync(() =>
            fs.writeFile(file, content, 'utf8'),
        );
        if (err)
            Logger.scope('Plugin Loader').error(
                `Failed to save plugin state: ${Logger.formatError(err)}`,
            );
    }

    public register(plugin: typeof CasparPlugin) {
        const loaderLogger = Logger.scope('Plugin Loader');
        const pluginLabel =
            (plugin as any).pluginName ?? plugin.name ?? 'unknown';

        const [instErr, _plugin] = noTry(() => new plugin());
        if (instErr) {
            loaderLogger.error(
                `Failed to instantiate plugin "${pluginLabel}": ${Logger.formatError(instErr)}`,
            );
            return;
        }

        const pluginLogger = loaderLogger.scope(_plugin.pluginName);

        const [apiErr] = noTry(
            () => new PluginAPI(CasparManager.getManager() as any, _plugin),
        );
        if (apiErr) {
            pluginLogger.error(
                `Failed to attach plugin API: ${Logger.formatError(apiErr)}`,
            );
            return;
        }

        this._plugins.push(_plugin);
        pluginLogger.debug('Loaded');

        if (this._enabled && !this._disabled.has(_plugin.pluginName))
            this._applyEnable(_plugin, pluginLogger);
    }

    public unregister(plugin: CasparPlugin) {
        const index = this._plugins.indexOf(plugin);
        if (index < 0) return;

        this._plugins.splice(index, 1);
        const pluginLogger = Logger.scope('Plugin Loader').scope(
            plugin.pluginName,
        );
        this._applyDisable(plugin, pluginLogger);
    }

    public get plugins() {
        return this._plugins;
    }

    private _enabled: boolean = false;
    public enableAll() {
        if (this._enabled) return;
        this._enabled = true;

        for (const plugin of this._plugins) {
            if (this._disabled.has(plugin.pluginName)) continue;
            const pluginLogger = Logger.scope('Plugin Loader').scope(
                plugin.pluginName,
            );
            this._applyEnable(plugin, pluginLogger);
        }
    }

    public disableAll() {
        if (!this._enabled) return;
        this._enabled = false;

        for (const plugin of this._plugins) {
            const pluginLogger = Logger.scope('Plugin Loader').scope(
                plugin.pluginName,
            );
            this._applyDisable(plugin, pluginLogger);
        }
    }

    public enablePlugin(plugin: CasparPlugin, logger: Logger) {
        this._applyEnable(plugin, logger);
        if (this._disabled.delete(plugin.pluginName)) this.saveState();
    }

    public disablePlugin(plugin: CasparPlugin, logger: Logger) {
        this._applyDisable(plugin, logger);
        if (!this._disabled.has(plugin.pluginName)) {
            this._disabled.add(plugin.pluginName);
            this.saveState();
        }
    }

    private _applyEnable(plugin: CasparPlugin, logger: Logger) {
        const [err] = noTry(() => plugin['enable'](logger));
        if (err)
            logger.error(`Failed to enable plugin: ${Logger.formatError(err)}`);
    }

    // Tears the plugin down, then strips any rundown actions it had
    // registered so disabled-plugin types stop appearing in the picker and
    // items keyed off them silently no-op. Ownership is set at registration
    // time by `PluginAPI.registerRundownAction` (which passes the plugin
    // name), so this cleanup catches both sync- and async-registered
    // actions.
    private _applyDisable(plugin: CasparPlugin, logger: Logger) {
        const [err] = noTry(() => plugin['disable'](logger));
        if (err)
            logger.error(
                `Failed to disable plugin: ${Logger.formatError(err)}`,
            );
        CasparManager.getManager().rundowns.executor.unregisterActionsByOwner(
            plugin.pluginName,
        );
    }

    public get enabled() {
        return this._enabled;
    }

    public broadcast(event: string, ...args: any[]) {
        for (const plugin of this._plugins) plugin['_api'].emit(event, ...args);
    }
}
