import {
    type Effect,
    type EffectGroup,
    type IngestSession,
    type ShareLink,
} from '@lappis/cg-manager';

/** Our own copy of the `routes:source-types` contract, declared rather than
 *  imported — exactly what an external plugin contributing a source type has
 *  to do. Only the parts of a route this plugin reads are named. */
export interface RouteSourceType {
    type: string;
    label: string;
    description?: string;
    validate?(source: Record<string, unknown>): boolean;
    createEffect(context: {
        group: EffectGroup;
        source: Record<string, unknown>;
        route: {
            id: string;
            transform?: number[];
            edgeblend?: number[];
            perspective?: number[];
        };
    }): Effect | null;
}

export interface ScreenshareDestination {
    /** `<channel>:<groupName>`, as `PluginAPI.getEffectGroup` expects. */
    effectLayer: string;
    index?: number;
    /** Source then destination rect, as `Transform.fromArray` reads them. */
    transform?: number[];
}

export interface ScreenshareService {
    listSessions(): IngestSession[];
    listShares(): ShareLink[];
    createShare(data: {
        label?: string;
        maxSessions?: number;
    }): Promise<ShareLink>;
    revokeShare(id: string): Promise<void>;

    /** Put a live session on screen, replacing whatever that session showed before. */
    show(sessionId: string, destination: ScreenshareDestination): Promise<void>;
    hide(sessionId: string): Promise<void>;
    shown(): string[];
}
