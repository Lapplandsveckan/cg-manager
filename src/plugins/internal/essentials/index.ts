import fs from 'fs';
import path from 'path';
import { CasparPlugin, UI_INJECTION_ZONE } from '@lappis/cg-manager';
import { type RundownItem } from '@lappis/cg-manager/dist/types/rundown';

const TOGGLE_VIDEO_ROUTE = 'toggle-video-route';

interface ToggleVideoRouteData {
    routeId: string;
}

export default class EssentialsPlugin extends CasparPlugin {
    public static get pluginName() {
        return 'essentials';
    }

    protected onEnable() {
        this.api.registerRundownAction(
            TOGGLE_VIDEO_ROUTE,
            item => this.toggleVideoRoute(item),
            { stop: item => this.stopVideoRoute(item) },
        );

        // The PluginAPI signature narrows to UI_INJECTION_ZONE, but the host's
        // UIInjector accepts the `${zone}.${type}` form too — that's how the
        // editor / inline display get scoped to one action type.
        const editorZone =
            `${UI_INJECTION_ZONE.RUNDOWN_EDITOR}.${TOGGLE_VIDEO_ROUTE}` as UI_INJECTION_ZONE;
        const itemZone =
            `${UI_INJECTION_ZONE.RUNDOWN_ITEM}.${TOGGLE_VIDEO_ROUTE}` as UI_INJECTION_ZONE;

        // In dev (ts-node) __dirname is src/…/essentials and only .tsx exists.
        // In the packaged snapshot tsc emits .jsx (jsx:"preserve") so only .jsx exists.
        this.api.registerUI(editorZone, this.uiFile('editor'));
        this.api.registerUI(itemZone, this.uiFile('item'));
    }

    private uiFile(name: string) {
        const base = path.join(__dirname, 'ui', name);
        return fs.existsSync(`${base}.tsx`) ? `${base}.tsx` : `${base}.jsx`;
    }

    private toggleVideoRoute(item: RundownItem) {
        const data = item.data as ToggleVideoRouteData | undefined;
        const routeId = data?.routeId;
        if (typeof routeId !== 'string' || !routeId) {
            this.logger.warn(
                `toggle-video-route: missing routeId on item ${item.id}`,
            );
            return;
        }

        const route = this.api.getVideoRoute(routeId);
        if (!route) {
            this.logger.warn(`toggle-video-route: no route with id ${routeId}`);
            return;
        }

        this.api.setVideoRouteEnabled(routeId, !route.enabled);
    }

    private stopVideoRoute(item: RundownItem) {
        const data = item.data as ToggleVideoRouteData | undefined;
        const routeId = data?.routeId;
        if (typeof routeId !== 'string' || !routeId) {
            this.logger.warn(
                `toggle-video-route stop: missing routeId on item ${item.id}`,
            );
            return;
        }

        const route = this.api.getVideoRoute(routeId);
        if (!route) {
            this.logger.warn(
                `toggle-video-route stop: no route with id ${routeId}`,
            );
            return;
        }

        this.api.setVideoRouteEnabled(routeId, false);
    }
}
