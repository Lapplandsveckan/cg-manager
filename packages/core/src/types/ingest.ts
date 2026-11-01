export interface ShareLink {
    id: string;
    token: string;
    label: string;
    maxSessions: number;
    allowAudio: boolean;
    createdAt: number;
    expiresAt?: number | null;
}

export type ShareLinkInput = Omit<ShareLink, 'id' | 'token' | 'createdAt'>;

export type IngestSessionState = 'connecting' | 'live' | 'closed';

export interface IngestSession {
    id: string;
    label: string;
    /** What to hand CasparCG. Survives a change of ingest transport, so effects
     *  built on it keep working when the media path is reimplemented. */
    url: string;
    state: IngestSessionState;
    hasVideo: boolean;
    hasAudio: boolean;
    startedAt: number;
    shareId?: string | null;
}

export interface IngestSessionEvent {
    type: 'open' | 'update' | 'close';
    session: IngestSession;
}

export type IngestSessionHandler = (event: IngestSessionEvent) => void;

export type ShareLinkWithPath = ShareLink & { path: string | null };

export interface IngestApi {
    listShares(): ShareLink[];
    /** `listShares` plus each share's guest path — what UIs and broadcasts
     *  send, so a client patching from a broadcast doesn't lose the path. */
    listSharesWithPath(): ShareLinkWithPath[];
    getShare(id: string): ShareLink | null;
    createShare(data: Partial<ShareLinkInput>): Promise<ShareLink>;
    revokeShare(id: string): Promise<void>;
    /** Path a guest opens to start sharing, relative to the manager's origin. */
    sharePath(id: string): string | null;

    listSessions(): IngestSession[];
    getSession(id: string): IngestSession | null;
    closeSession(id: string): Promise<void>;

    onSession(handler: IngestSessionHandler): () => void;
    offSession(handler: IngestSessionHandler): void;
}
