import { type IngestSession, type ShareLink } from '@lappis/cg-manager';

export interface ScreenshareDestination {
    /** `<channel>:<groupName>`, as `PluginAPI.getEffectGroup` expects. */
    effectLayer: string;
    index?: number;
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
