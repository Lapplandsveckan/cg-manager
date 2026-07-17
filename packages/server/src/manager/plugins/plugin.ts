import path from 'path';
import { type CasparPlugin, PluginAPI } from '@lappis/cg-manager';
import { noTry, noTryAsync } from 'no-try';
import { Logger } from '../../util/log';
import config from '../../util/config';
import { listVersionsSync } from '../../plugins/versions';
import { readState, writeState } from '../../plugins/state';
import { PluginDependencyResolver } from './dependencies';
import { PluginVersionManager } from './version-management';
import { CasparManager } from '../index';

export class PluginManager {
    private _plugins: CasparPlugin[] = [];
    private _disabled: Set<string> = new Set();
    /** pluginName -> currently loaded dir (active version dir for external
     *  plugins, flat internal dir for built-ins). */
    private _pluginDirs = new Map<string, string>();
    private _builtin = new Set<string>();
    private _minChannels = new Map<string, number>();
    /** Plugins skipped at enable time solely because of insufficient channels. */
    private _channelBlocked = new Set<string>();
    private _channelCount = 0;
    private _deps = new PluginDependencyResolver();
    /** folderName -> active version, for external (uploaded) plugins. */
    private _active: Record<string, string> = {};
    /** pluginName -> on-disk folder name. External plugins only — the
     *  runtime identity (pluginName) and the on-disk identity (sanitized
     *  package name) are independent. */
    private _folderNames = new Map<string, string>();
    /** folderName -> installed versions, newest-first. Cached so the sync
     *  list() can include it without hitting disk on every call. */
    private _versions = new Map<string, string[]>();

    private get pluginsDir(): string {
        return path.resolve(process.cwd(), config['plugins-dir']);
    }

    public async loadState() {
        const state = await readState();
        this._disabled = state.disabled;
        this._active = state.active;
    }

    /** Snapshot of the persisted active-version selections, used by the
     *  plugin loader to resolve which version to load at startup. */
    public getActiveMap(): Record<string, string> {
        return { ...this._active };
    }

    public getFolderName(pluginName: string): string | undefined {
        return this._folderNames.get(pluginName);
    }

    public setChannelCount(n: number) {
        this._channelCount = n;
    }

    private _meetsChannels(name: string) {
        return this._channelCount >= (this._minChannels.get(name) ?? 0);
    }

    private _maybeAutoEnable(plugin: CasparPlugin, logger: Logger) {
        const name = plugin.pluginName;
        if (!this._enabled || this._disabled.has(name)) return;
        if (!this._meetsChannels(name)) {
            this._channelBlocked.add(name);
            const need = this._minChannels.get(name) ?? 0;
            logger.debug(
                `Blocked: needs ${need} channel${need === 1 ? '' : 's'}, have ${this._channelCount}`,
            );
            return;
        }
        this._channelBlocked.delete(name);

        const missingDeps = this._deps.evaluate(name, this._plugins);
        if (missingDeps.length) {
            logger.debug(
                `Blocked: missing dependencies: ${missingDeps.join(', ')}`,
            );
            return;
        }

        this._applyEnable(plugin, logger);
    }

    private _isGateBlocked(name: string) {
        return this._channelBlocked.has(name) || this._deps.isBlocked(name);
    }

    // Only hard-dependency cycles actually block enabling — one formed
    // purely by optional deps just falls back to registration order and
    // enables fine, so that case is logged quietly instead of as an error.
    private _logCycle(cyclic: CasparPlugin[]) {
        if (!cyclic.length) return;
        const names = new Set(cyclic.map(p => p.pluginName));
        const hard = cyclic.some(p =>
            this._deps.dependenciesOf(p.pluginName).some(d => names.has(d)),
        );
        const message = `Dependency cycle detected involving: ${[...names].join(', ')}`;
        const logger = Logger.scope('Plugin Loader');
        if (hard) logger.error(message);
        else logger.debug(message);
    }

    /** Re-checks every channel- or dependency-blocked plugin and enables any
     *  that are now satisfied, looping to a fixpoint (one pass can enable a
     *  provider after its dependent was already checked in that same pass).
     *  Returns whether anything changed. */
    private _recomputeBlocked(): boolean {
        let anyChanged = false;
        let changedThisPass = true;
        while (changedThisPass) {
            changedThisPass = false;
            for (const name of new Set([
                ...this._channelBlocked,
                ...this._deps.blockedNames(),
            ])) {
                const plugin = this._plugins.find(p => p.pluginName === name);
                if (!plugin) {
                    this._channelBlocked.delete(name);
                    continue;
                }
                this._maybeAutoEnable(
                    plugin,
                    Logger.scope('Plugin Loader').scope(name),
                );
                if (!this._isGateBlocked(name))
                    changedThisPass = anyChanged = true;
            }
        }
        return anyChanged;
    }

    private async saveState() {
        const [err] = await noTryAsync(() =>
            writeState(this._disabled, this._active),
        );
        if (err)
            Logger.scope('Plugin Loader').error(
                `Failed to save plugin state: ${Logger.formatError(err)}`,
            );
    }

    /** Refresh the in-memory version-list cache for a folder from disk. */
    private refreshVersions(folderName: string) {
        this._versions.set(
            folderName,
            listVersionsSync(this.pluginsDir, folderName).map(v => v.version),
        );
    }

    public register(
        plugin: typeof CasparPlugin,
        dir?: string,
        builtin = false,
    ) {
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
        if (dir) this._pluginDirs.set(_plugin.pluginName, dir);
        if (builtin) {
            this._builtin.add(_plugin.pluginName);
        } else if (dir) {
            // dir is `<pluginsDir>/<folderName>/<version>` for external plugins.
            const folderName = path.basename(path.dirname(dir));
            this._folderNames.set(_plugin.pluginName, folderName);
            this.refreshVersions(folderName);
        }
        const minCh = (plugin as any).minChannels ?? 0;
        this._minChannels.set(_plugin.pluginName, minCh);
        this._deps.capture(
            _plugin.pluginName,
            ((plugin as any).dependencies ?? []) as string[],
            ((plugin as any).optionalDependencies ?? []) as string[],
        );
        pluginLogger.debug('Loaded');

        this._maybeAutoEnable(_plugin, pluginLogger);
        // Hot-loaded outside the initial enableAll() sweep (e.g. a plugin
        // upload) — this newly-registered plugin may itself be the
        // dependency an already-registered, dependency-blocked plugin was
        // waiting on.
        if (this._enabled) this._recomputeBlocked();
    }

    public unregister(plugin: CasparPlugin) {
        const index = this._plugins.indexOf(plugin);
        if (index < 0) return;

        this._plugins.splice(index, 1);
        this._pluginDirs.delete(plugin.pluginName);
        this._builtin.delete(plugin.pluginName);
        this._minChannels.delete(plugin.pluginName);
        this._channelBlocked.delete(plugin.pluginName);
        this._folderNames.delete(plugin.pluginName);
        this._deps.forget(plugin.pluginName);
        const pluginLogger = Logger.scope('Plugin Loader').scope(
            plugin.pluginName,
        );
        this._applyDisable(plugin, pluginLogger);
        // The plugin is gone entirely, not just disabled — anything that
        // hard-depends on it can no longer run.
        this._disableDependents(plugin.pluginName);
    }

    /** Disables every enabled plugin that (transitively) hard-depends on `name`. */
    private _disableDependents(name: string) {
        for (const p of this._deps.cascadeBlocked(name, this._plugins)) {
            const logger = Logger.scope('Plugin Loader').scope(p.pluginName);
            this._applyDisable(p, logger);
        }
    }

    public get plugins() {
        return this._plugins;
    }

    public isBuiltin(name: string) {
        return this._builtin.has(name);
    }

    /** Serializable plugin list for the API / WS broadcast. */
    public list() {
        return this._plugins.map(p => {
            const folderName = this._folderNames.get(p.pluginName);
            // Derive the displayed active version from the dir actually
            // loaded, rather than the persisted selection — this stays
            // correct even before any explicit setActiveVersion call has
            // persisted a choice (e.g. right after startup discovery).
            const loadedDir = this._pluginDirs.get(p.pluginName);
            const activeVersion = folderName
                ? (this._active[folderName] ??
                  (loadedDir ? path.basename(loadedDir) : undefined))
                : undefined;
            const isDepBlocked = this._deps.isBlocked(p.pluginName);
            const missingDeps = isDepBlocked
                ? this._deps.missing(p.pluginName, this._plugins)
                : [];
            const blockedReason = this._channelBlocked.has(p.pluginName)
                ? ('channels' as const)
                : isDepBlocked
                  ? ('dependency' as const)
                  : undefined;
            return {
                name: p.pluginName,
                enabled: p['_enabled'] as boolean,
                builtin: this._builtin.has(p.pluginName),
                minChannels: this._minChannels.get(p.pluginName) ?? 0,
                dependencies: this._deps.dependenciesOf(p.pluginName),
                ...(blockedReason && { blockedReason }),
                ...(missingDeps.length && { missingDeps }),
                ...(folderName && {
                    folderName,
                    activeVersion,
                    versions: this._versions.get(folderName) ?? [],
                }),
            };
        });
    }

    private _enabled: boolean = false;
    public enableAll() {
        if (this._enabled) return;
        this._enabled = true;

        // Providers must be attempted before dependents so a dependent's
        // first `_maybeAutoEnable` check sees its dependency already enabled.
        const { ordered, cyclic } = this._deps.order(this._plugins);
        this._logCycle(cyclic);
        for (const plugin of ordered) {
            const pluginLogger = Logger.scope('Plugin Loader').scope(
                plugin.pluginName,
            );
            this._maybeAutoEnable(plugin, pluginLogger);
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
        this._channelBlocked.delete(plugin.pluginName);
        this._deps.clearBlocked(plugin.pluginName);
        this._applyEnable(plugin, logger);
        if (this._disabled.delete(plugin.pluginName)) this.saveState();
        // This plugin may itself have been the missing dependency for others.
        this._recomputeBlocked();
        CasparManager.getManager().emit('plugin-list-changed');
    }

    public disablePlugin(plugin: CasparPlugin, logger: Logger) {
        this._channelBlocked.delete(plugin.pluginName);
        this._applyDisable(plugin, logger);
        this._disableDependents(plugin.pluginName);
        if (!this._disabled.has(plugin.pluginName)) {
            this._disabled.add(plugin.pluginName);
            this.saveState();
        }
        CasparManager.getManager().emit('plugin-list-changed');
    }

    /** Update the running channel count and auto-enable any blocked plugins now satisfied. */
    public updateChannelCount(n: number) {
        this._channelCount = n;
        if (this._recomputeBlocked())
            CasparManager.getManager().emit('plugin-list-changed');
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
        const manager = CasparManager.getManager();
        manager.rundowns.executor.unregisterActionsByOwner(plugin.pluginName);
        // CompanionRegistry also tracks sub-cleanup internally, but calling
        // unregisterOwner here ensures the broadcast fires before the plugin's
        // own API teardown clears its handle list.
        manager.companion.unregisterOwner(plugin.pluginName);
    }

    public get enabled() {
        return this._enabled;
    }

    /** Install/version lifecycle for external (uploaded) plugins. */
    public versions = new PluginVersionManager(this);

    public broadcast(event: string, ...args: any[]) {
        for (const plugin of this._plugins) plugin['_api'].emit(event, ...args);
    }
}
