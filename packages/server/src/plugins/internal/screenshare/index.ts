import fs from 'fs';
import path from 'path';
import {
    CasparPlugin,
    UI_INJECTION_ZONE,
    type ContributionHandle,
    type IngestSessionEvent,
    type UI_INJECTION_ZONE_KEY,
    type RundownItem,
} from '@lappis/cg-manager';
import { noTry, noTryAsync } from 'no-try';
import { type Route } from 'rest-exchange-protocol';
import { ScreenshareManager } from './manager';
import { ScreenshareEffect } from './effects/screenshare';
import { parseValue } from '../../../api/validate';
import { registerScreenshareEndpoints } from './api';
import { showItemData, stopItemData } from './schemas';
import {
    ROUTE_SOURCE_POINT,
    ROUTE_SOURCE_TYPE,
    screenshareRouteSource,
} from './routeSource';
import { type RouteSourceType, type ScreenshareService } from './types';

const SHOW_SCREENSHARE = 'show-screenshare';

export default class ScreensharePlugin extends CasparPlugin {
    public static get pluginName() {
        return 'screenshare';
    }

    // No minChannels: ingesting and handing out share links work with
    // CasparCG down. Only `show` needs a channel, and it fails on its own.
    private manager!: ScreenshareManager;
    private endpoints: Route[] = [];
    private routeSource: ContributionHandle<RouteSourceType> | null = null;

    /** A session appearing or going away changes what a screenshare route can
     *  resolve, and re-publishing the contribution is what makes the routes
     *  plugin rebuild its effects. */
    private readonly onSession = (event: IngestSessionEvent) => {
        this.manager.onSession(event);
        if (event.type === 'update') return;

        this.routeSource?.update(screenshareRouteSource(this.api));
    };

    protected onEnable() {
        this.manager = new ScreenshareManager(this.api, this.logger);

        this.api.registerEffect(
            'screenshare',
            (group, options) =>
                new ScreenshareEffect(
                    group,
                    options as ConstructorParameters<
                        typeof ScreenshareEffect
                    >[1],
                    this.api.ingest,
                ),
        );

        this.endpoints = registerScreenshareEndpoints(this.api, this.manager);
        this.routeSource = this.api.contribute<RouteSourceType>(
            ROUTE_SOURCE_POINT,
            screenshareRouteSource(this.api),
        );
        this.provideService();
        this.registerRundownAction();
        this.registerUI();

        this.api.ingest.onSession(this.onSession);
        this.api.onConnect(this.manager.refresh);
    }

    protected onDisable() {
        for (const endpoint of this.endpoints)
            noTry(() => this.api.unregisterRoute(endpoint));
        this.endpoints = [];

        // onEnable can throw before `manager` is assigned; the route cleanup
        // above must still happen in that case.
        if (!this.manager) return;

        this.api.offConnect(this.manager.refresh);
        this.api.ingest.offSession(this.onSession);
        this.routeSource = null;
        this.manager.disposeAll();
    }

    private provideService() {
        const service: ScreenshareService = {
            listSessions: () => this.api.ingest.listSessions(),
            listShares: () => this.api.ingest.listShares(),
            createShare: data => this.api.ingest.createShare(data),
            revokeShare: id => this.api.ingest.revokeShare(id),
            show: (id, destination) => this.manager.show(id, destination),
            hide: id => this.manager.hide(id),
            shown: () => this.manager.shownIds(),
        };

        this.api.provideService<ScreenshareService>('screenshare', service);
    }

    private registerRundownAction() {
        this.api.registerRundownAction(
            SHOW_SCREENSHARE,
            async (item: RundownItem) => {
                const { sessionId, ...destination } = parseValue(
                    showItemData,
                    item.data,
                );

                await this.manager.show(sessionId, destination);
            },
            {
                displayName: 'Show screen share',
                description: 'Put an incoming screen share on a channel',
                category: 'Media',
                iconKey: 'ScreenShare',
                stop: async (item: RundownItem) => {
                    const parsed = stopItemData.safeParse(item.data);
                    if (!parsed.success) return;

                    await noTryAsync(() =>
                        this.manager.hide(parsed.data.sessionId),
                    );
                },
            },
        );
    }

    private registerUI() {
        const zone = (name: string) => name as UI_INJECTION_ZONE_KEY;

        this.api.registerUI(UI_INJECTION_ZONE.NAVBAR_PAGE, this.uiFile('page'));
        this.api.registerUI(
            zone(`${UI_INJECTION_ZONE.RUNDOWN_EDITOR}.${SHOW_SCREENSHARE}`),
            this.uiFile('editor'),
        );
        this.api.registerUI(
            zone(`plugin:routes.source.${ROUTE_SOURCE_TYPE}`),
            this.uiFile('routeSource'),
        );
    }

    private uiFile(name: string) {
        const base = path.join(__dirname, 'ui', name);

        return fs.existsSync(`${base}.tsx`) ? `${base}.tsx` : `${base}.jsx`;
    }
}
