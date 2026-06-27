import { EventEmitter } from 'events';
import { EffectRegistry } from '@lappis/cg-manager';
import { Logger } from '../util/log';
import { MediaScanner } from './scanner';
import { CasparProcess, type CasparStatus } from './caspar/process';
import { CasparExecutor } from './caspar/executor';
import { PluginManager } from './plugins/plugin';
import { type CGServer } from '../api/server';
import { DirectoryManager } from './scanner/dir';
import { FileDatabase } from './scanner/db';
import { UIInjector } from './plugins/ui';
import { RundownManager } from './rundown/rundown';
import { VideoRoutesManager } from './routes/routes';
import { PreviewManager } from './preview/preview';

export class CasparManager extends EventEmitter {
    public scanner: MediaScanner;
    public caspar: CasparProcess;
    public executor: CasparExecutor;
    public effects: EffectRegistry;
    public plugins: PluginManager;
    public server: CGServer;
    public ui: UIInjector;
    public rundowns: RundownManager;
    public routes: VideoRoutesManager;
    public preview: PreviewManager;

    private readonly onCasparStatusBroadcast = (status: CasparStatus) =>
        this.emit('caspar-status', status);
    private readonly onCasparStatusReconnect = (status: CasparStatus) =>
        status.running ? this.executor.connect() : this.executor.disconnect();
    private readonly onCasparLog = (log: string) =>
        this.emit('caspar-logs', log);
    // Re-emit the CasparCG running-config event for UI consumers (preview
    // chips, config drift banner). The executor already buffers / drops
    // commands aimed at non-existent channels, so routes targeting missing
    // channels degrade gracefully on their own — no need to re-check
    // routes here.
    private readonly onCasparRunningConfig = (cfg: unknown) =>
        this.emit('caspar-running-config', cfg);
    private readonly onDbChange = (key: string, value: unknown) =>
        this.emit('media', key, value);

    public get db() {
        return FileDatabase.db;
    }

    private static instance: CasparManager;
    public static getManager() {
        if (!CasparManager.instance)
            CasparManager.instance = new CasparManager();
        return CasparManager.instance;
    }

    private constructor() {
        super();

        this.scanner = new MediaScanner();
        this.caspar = new CasparProcess();
        this.effects = new EffectRegistry();
        this.executor = new CasparExecutor();
        this.plugins = new PluginManager();
        this.ui = new UIInjector();
        this.rundowns = new RundownManager();
        this.routes = new VideoRoutesManager(this);
        this.preview = new PreviewManager(this.executor);

        this.caspar.on('status', this.onCasparStatusBroadcast);
        this.caspar.on('status', this.onCasparStatusReconnect);
        this.caspar.on('log', this.onCasparLog);
        this.caspar.on('running-config', this.onCasparRunningConfig);

        // Route effects can only be built once the AMCP socket is up. Activate
        // them on every connect — first boot (routes were loaded while the
        // socket was still warming up) and reconnect (CasparCG was wiped, so
        // the existing effects are stale refs and must be rebuilt).
        //
        // Channel allocation also happens here rather than in start() so that
        // allocateChannel() (and any AMCP commands emitted by initial layer
        // allocations) runs against a live socket instead of being enqueued
        // pre-connect where the 1 s response timer would start before CasparCG
        // can actually respond.
        this.unsubConnect = this.executor.onConnect(() => {
            if (!this.channelsAllocated) {
                this.channelsAllocated = true;
                const channels = this.caspar.config?.channels;
                if (!channels) {
                    Logger.warn(
                        'Skipping channel allocation: CasparCG config has no channels.',
                    );
                } else {
                    Logger.info(
                        `Allocating ${channels.length} channel${channels.length === 1 ? '' : 's'}...`,
                    );
                    for (let i = 0; i < channels.length; i++)
                        this.executor.allocateChannel(i + 1);
                }
            }
            this.routes.refreshEffects();
        });

        // A reconnect also means plugin-owned state no longer matches reality.
        // Broadcast a `caspar-reconnect` event so plugins can re-apply whatever
        // they own. (Route effects are handled by onConnect above.)
        this.unsubReconnect = this.executor.onReconnect(() => {
            Logger.info('CasparCG reconnected — refreshing host state.');
            this.emit('caspar-reconnect');
        });
    }

    private channelsAllocated = false;
    private unsubConnect: (() => void) | null = null;
    private unsubReconnect: (() => void) | null = null;

    public getServer() {
        return this.server;
    }

    async start() {
        Logger.info('Starting media scanner...');
        await this.scanner.start();

        FileDatabase.db.on('change', this.onDbChange);

        Logger.info('Starting Caspar CG process...');
        await this.caspar.start();

        Logger.info('Starting rundown auto save...');
        this.rundowns.startAutosave();
        await this.rundowns.loadRundowns();
    }

    async stop() {
        this.rundowns.stopAutosave();
        await this.rundowns.saveAllRundowns();

        await this.preview.disposeAll();
        this.routes.disposeAll();
        this.executor.disconnect();

        await this.scanner.stop();
        await this.caspar.stop();

        this.unsubConnect?.();
        this.unsubConnect = null;
        this.unsubReconnect?.();
        this.unsubReconnect = null;

        this.caspar.off('status', this.onCasparStatusBroadcast);
        this.caspar.off('status', this.onCasparStatusReconnect);
        this.caspar.off('log', this.onCasparLog);
        this.caspar.off('running-config', this.onCasparRunningConfig);
        FileDatabase.db.off('change', this.onDbChange);

        // Drop listeners the server (and anything else) attached on the manager
        // — caspar-status, caspar-logs, media — so they don't pin us in memory.
        this.removeAllListeners();
    }

    public getMediaScanner() {
        return this.scanner;
    }

    public getCasparProcess() {
        return this.caspar;
    }

    public getExecutor() {
        return this.executor;
    }

    public get directory() {
        return DirectoryManager.getManager();
    }

    public getPlugins() {
        return this.plugins;
    }

    public getFiles() {
        return this.db;
    }

    public getPluginInjections() {
        return this.ui.getInjections();
    }

    public getPluginInjectionCode(id: string) {
        return this.ui.bundle(id);
    }

    public getLogger(scope: string) {
        return Logger.scope(scope);
    }
}
