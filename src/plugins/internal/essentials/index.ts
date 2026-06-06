import path from 'path';
import {CasparPlugin, UI_INJECTION_ZONE} from '@lappis/cg-manager';
import {type RundownItem} from '@lappis/cg-manager/dist/types/rundown';

const TOGGLE_VIDEO_ROUTE = 'toggle-video-route';

interface ToggleVideoRouteData {
    routeId: string;
}

export default class EssentialsPlugin extends CasparPlugin {
    public static get pluginName() {
        return 'essentials';
    }

    protected onEnable() {
        this.api.registerRundownAction(TOGGLE_VIDEO_ROUTE, item => this.toggleVideoRoute(item));

        // The PluginAPI signature narrows to UI_INJECTION_ZONE, but the host's
        // UIInjector accepts the `${zone}.${type}` form too — that's how the
        // editor / inline display get scoped to one action type.
        const editorZone = `${UI_INJECTION_ZONE.RUNDOWN_EDITOR}.${TOGGLE_VIDEO_ROUTE}` as UI_INJECTION_ZONE;
        const itemZone = `${UI_INJECTION_ZONE.RUNDOWN_ITEM}.${TOGGLE_VIDEO_ROUTE}` as UI_INJECTION_ZONE;

        this.api.registerUI(editorZone, path.join(__dirname, 'ui', 'editor.tsx'));
        this.api.registerUI(itemZone, path.join(__dirname, 'ui', 'item.tsx'));
    }

    private toggleVideoRoute(item: RundownItem) {
        const data = item.data as ToggleVideoRouteData | undefined;
        const routeId = data?.routeId;
        if (typeof routeId !== 'string' || !routeId) {
            this.logger.warn(`toggle-video-route: missing routeId on item ${item.id}`);
            return;
        }

        const route = this.api['_manager'].routes.getVideoRoute(routeId);
        if (!route) {
            this.logger.warn(`toggle-video-route: no route with id ${routeId}`);
            return;
        }

        this.api.setVideoRouteEnabled(routeId, !route.enabled);
    }
}
