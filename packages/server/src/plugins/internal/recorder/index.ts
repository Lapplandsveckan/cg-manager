import fs from 'fs';
import path from 'path';
import {
    CasparPlugin,
    UI_INJECTION_ZONE,
    type UI_INJECTION_ZONE_KEY,
} from '@lappis/cg-manager';
import { PRESETS } from './presets';
import { RecordingManager, type StartRecordingOptions } from './recordings';
import { registerDownloadRoutes } from './http';

const RECORD_CHANNEL = 'record-channel';

const startOptionsOf = (data: unknown): StartRecordingOptions => {
    const d = (data as Partial<StartRecordingOptions>) ?? {};
    return {
        channel: Number(d.channel),
        presetId: String(d.presetId ?? ''),
        name: typeof d.name === 'string' ? d.name : undefined,
        durationSec:
            typeof d.durationSec === 'number' ? d.durationSec : undefined,
    };
};

export default class RecorderPlugin extends CasparPlugin {
    public static get pluginName() {
        return 'recorder';
    }

    private recordings!: RecordingManager;

    private readonly handleReconnect = () =>
        void this.recordings.handleReconnect();

    protected async onEnable() {
        this.recordings = new RecordingManager(this.api, this.logger);
        await this.recordings.init();

        this.registerRoutes();
        this.registerHttp();
        this.registerRundownAction();
        this.registerUI();
        this.api.onReconnect(this.handleReconnect);
    }

    protected onDisable() {
        this.api.offReconnect(this.handleReconnect);
        this.recordings?.disposeAll();
    }

    private registerHttp() {
        const router = this.api.createHttpRouter();
        registerDownloadRoutes(router, this.recordings);
        this.api.registerHttpHandler(router);
    }

    private registerRoutes() {
        this.api.registerRoute(
            'presets',
            () =>
                PRESETS.map(({ id, extension, alpha }) => ({
                    id,
                    extension,
                    alpha,
                })),
            'GET',
        );

        this.api.registerRoute(
            'recordings',
            () => this.recordings.list(),
            'GET',
        );

        this.api.registerRoute(
            'recordings',
            req => this.recordings.start(startOptionsOf(req.getData())),
            'ACTION',
        );

        this.api.registerRoute(
            'recordings/:id/stop',
            req => this.recordings.stop(String(req.getParams().id)),
            'ACTION',
        );

        this.api.registerRoute(
            'recordings/:id/import',
            req => {
                const { folder } = (req.getData() as { folder?: string }) ?? {};
                return this.recordings.importToMedia(
                    String(req.getParams().id),
                    folder,
                );
            },
            'ACTION',
        );

        this.api.registerRoute(
            'recordings/:id',
            req => this.recordings.remove(String(req.getParams().id)),
            'DELETE',
        );
    }

    private registerRundownAction() {
        this.api.registerRundownAction(
            RECORD_CHANNEL,
            async item =>
                void (await this.recordings.start(startOptionsOf(item.data))),
            {
                stop: async item =>
                    void (await this.recordings.stopChannel(
                        Number(item.data?.channel),
                    )),
            },
        );
    }

    private registerUI() {
        const zone = (name: string) => name as UI_INJECTION_ZONE_KEY;

        this.api.registerUI(UI_INJECTION_ZONE.NAVBAR_PAGE, this.uiFile('page'));
        this.api.registerUI(
            zone(`${UI_INJECTION_ZONE.RUNDOWN_EDITOR}.${RECORD_CHANNEL}`),
            this.uiFile('editor'),
        );
        this.api.registerUI(
            zone(`${UI_INJECTION_ZONE.RUNDOWN_ITEM}.${RECORD_CHANNEL}`),
            this.uiFile('item'),
        );
    }

    private uiFile(name: string) {
        const base = path.join(__dirname, 'ui', name);
        return fs.existsSync(`${base}.tsx`) ? `${base}.tsx` : `${base}.jsx`;
    }
}
