import fs from 'fs';
import path from 'path';
import {
    CasparPlugin,
    UI_INJECTION_ZONE,
    type RundownItem,
    type UI_INJECTION_ZONE_KEY,
} from '@lappis/cg-manager';
import { noTry, noTryAsync } from 'no-try';
import { WebsocketOutboundMethod } from 'rest-exchange-protocol';
import { VideoEffect, type VideoEffectOptions } from './effects/video';
import { RouteEffect, type RouteEffectOptions } from './effects/route';
import { ColorEffect, type ColorEffectOptions } from './effects/color';
import { DecklinkEffect, type DecklinkEffectOptions } from './effects/decklink';
import { registerRouteEndpoints } from './api';
import { type VideoRoutesService } from './types';
import { VideoRoutesManager, type RouteChangeMethod } from './manager';

const TOGGLE_VIDEO_ROUTE = 'toggle-video-route';

// MIGRATION-SHIM: see CLAUDE.md "Temporary migration shims"
const legacyRoutesDir = () => {
    const file = path.join(process.cwd(), 'config.json');
    const [, config] = noTry(() => JSON.parse(fs.readFileSync(file, 'utf8')));

    return path.resolve(config?.['routes-dir'] ?? './routes');
};

const routeIdOf = (item: RundownItem) => {
    const routeId = (item.data as { routeId?: unknown } | undefined)?.routeId;
    return typeof routeId === 'string' && routeId ? routeId : null;
};

export default class VideoRoutesPlugin extends CasparPlugin {
    public static get pluginName() {
        return 'routes';
    }

    private disabled = false;
    private manager!: VideoRoutesManager;
    private endpoints: ReturnType<typeof registerRouteEndpoints> = [];

    private readonly refresh = () => this.manager.refreshEffects();

    protected async onEnable() {
        this.disabled = false;
        const [err] = await noTryAsync(() => this.start());
        if (err) this.logger.error(`Failed to start routes plugin: ${err}`);
    }

    private async start() {
        this.registerEffects();

        const dataDir = path.join(process.cwd(), 'plugin-data', 'routes');
        this.manager = new VideoRoutesManager(
            this.api,
            dataDir,
            (method, data, exclude) => this.broadcast(method, data, exclude),
        );
        await this.manager.load(legacyRoutesDir());
        if (this.disabled) return;

        this.api.provideService<VideoRoutesService>('routes', {
            get: id => this.manager.get(id),
            list: () => this.manager.list(),
            create: data => this.manager.create(data),
            update: data => this.manager.update(data),
            delete: id => this.manager.delete(id),
            setEnabled: (id, enabled) => this.manager.setEnabled(id, enabled),
        });

        this.endpoints = registerRouteEndpoints(this.api, this.manager);
        this.registerRundownAction();
        this.registerUI();

        this.api.onConnect(this.refresh);
        if (this.api.isConnected()) this.refresh();
    }

    protected onDisable() {
        this.disabled = true;
        this.api.offConnect(this.refresh);
        for (const endpoint of this.endpoints)
            this.api.unregisterRoute(endpoint);

        this.endpoints = [];
        this.manager?.disposeAll();
    }

    private broadcast(
        method: RouteChangeMethod,
        data: unknown,
        exclude?: unknown,
    ) {
        this.api.broadcast(
            'routes',
            WebsocketOutboundMethod[method],
            data,
            exclude,
        );
    }

    private registerEffects() {
        this.api.registerEffect(
            'video',
            (group, options) =>
                new VideoEffect(group, options as VideoEffectOptions),
        );

        this.api.registerEffect(
            'route',
            (group, options) =>
                new RouteEffect(group, options as RouteEffectOptions),
        );

        this.api.registerEffect(
            'color',
            (group, options) =>
                new ColorEffect(group, options as ColorEffectOptions),
        );

        this.api.registerEffect(
            'decklink',
            (group, options) =>
                new DecklinkEffect(group, options as DecklinkEffectOptions),
        );
    }

    private registerRundownAction() {
        this.api.registerRundownAction(
            TOGGLE_VIDEO_ROUTE,
            item => this.toggleRoute(item),
            { stop: item => this.stopRoute(item) },
        );
    }

    private toggleRoute(item: RundownItem) {
        const route = this.routeFor(item, 'toggle-video-route');
        if (route) this.manager.setEnabled(route.id, !route.enabled);
    }

    private stopRoute(item: RundownItem) {
        const route = this.routeFor(item, 'toggle-video-route stop');
        if (route) this.manager.setEnabled(route.id, false);
    }

    private routeFor(item: RundownItem, label: string) {
        const routeId = routeIdOf(item);
        if (!routeId) {
            this.logger.warn(`${label}: missing routeId on item ${item.id}`);
            return null;
        }

        const route = this.manager.get(routeId);
        if (!route) this.logger.warn(`${label}: no route with id ${routeId}`);
        return route;
    }

    private registerUI() {
        const zone = (name: string) => name as UI_INJECTION_ZONE_KEY;

        this.api.registerUI(UI_INJECTION_ZONE.NAVBAR_PAGE, this.uiFile('page'));
        this.api.registerUI(UI_INJECTION_ZONE.GLOBAL, this.uiFile('global'));
        this.api.registerUI(
            zone(`${UI_INJECTION_ZONE.RUNDOWN_EDITOR}.${TOGGLE_VIDEO_ROUTE}`),
            this.uiFile('editor'),
        );
        this.api.registerUI(
            zone(`${UI_INJECTION_ZONE.RUNDOWN_ITEM}.${TOGGLE_VIDEO_ROUTE}`),
            this.uiFile('item'),
        );
        this.api.registerUI(
            zone(`${UI_INJECTION_ZONE.CONTEXT_MENU}.rundown-item`),
            this.uiFile('contextMenu'),
        );
    }

    private uiFile(name: string) {
        const base = path.join(__dirname, 'ui', name);
        return fs.existsSync(`${base}.tsx`) ? `${base}.tsx` : `${base}.jsx`;
    }
}
