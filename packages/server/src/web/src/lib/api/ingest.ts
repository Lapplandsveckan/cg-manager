export type IngestSessionState = 'connecting' | 'live' | 'closed';

export interface IngestSession {
    id: string;
    label: string;
    url: string;
    state: IngestSessionState;
    hasVideo: boolean;
    hasAudio: boolean;
    startedAt: number;
    shareId?: string | null;
}

export interface ShareLink {
    id: string;
    token: string;
    label: string;
    maxSessions: number;
    allowAudio: boolean;
    createdAt: number;
    expiresAt?: number | null;
    /** Server-rendered guest path; absent on payloads that don't include it. */
    path?: string | null;
}

/** What a guest sees before granting capture permission. */
export interface ShareInfo {
    label: string;
    allowAudio: boolean;
}

export const guestSharePath = (token: string) =>
    `/api/public/ingest/${encodeURIComponent(token)}`;

export const guestWhipPath = (token: string) => `${guestSharePath(token)}/whip`;

export const operatorWhipPath = (label: string) =>
    `/ingest-whip?label=${encodeURIComponent(label)}`;
