import { useCallback, useEffect, useState } from 'react';
import { useBroadcast, useSocket } from '@web-lib';
import { noTryAsync } from 'no-try';
import {
    type IngestSession,
    type ShareLink,
} from '../../../../web/src/lib/api/ingest';
import { type ScreenshareDestination } from '../types';
import {
    SESSIONS_PATH,
    SHARES_PATH,
    SHOWN_PATH,
    sessionActionPath,
    sessionPath,
    sessionsUpdated,
    sharePath,
    sharesUpdated,
} from './api';

export type Connection = ReturnType<typeof useSocket>;

/** Shared identity: returning a fresh `[]` while loading re-runs every effect
 *  that depends on the list, on every render. */
const NONE: never[] = [];

const get = async <T>(conn: Connection, path: string): Promise<T | null> => {
    const [, data] = await noTryAsync(() => conn.rawRequest(path, 'GET', null));

    return (data as T) ?? null;
};

export const showSession = (
    conn: Connection,
    id: string,
    destination: ScreenshareDestination,
) => conn.rawRequest(sessionActionPath(id, 'show'), 'ACTION', destination);

export const hideSession = (conn: Connection, id: string) =>
    conn.rawRequest(sessionActionPath(id, 'hide'), 'ACTION', null);

export const closeSession = (conn: Connection, id: string) =>
    conn.rawRequest(sessionPath(id), 'DELETE', null);

export const createShare = (
    conn: Connection,
    data: { label?: string; maxSessions?: number },
) => conn.rawRequest(SHARES_PATH, 'CREATE', data);

export const revokeShare = (conn: Connection, id: string) =>
    conn.rawRequest(sharePath(id), 'DELETE', null);

export function useIngestSessions() {
    const conn = useSocket();
    const [sessions, setSessions] = useState<IngestSession[] | null>(null);

    const refresh = useCallback(async () => {
        const list = await get<IngestSession[]>(conn, SESSIONS_PATH);
        if (list) setSessions(list);
    }, [conn]);

    useEffect(() => {
        void refresh();
    }, [refresh]);
    useBroadcast(sessionsUpdated, setSessions);

    return { sessions: sessions ?? NONE, loading: sessions === null, refresh };
}

export function useShareLinks() {
    const conn = useSocket();
    const [shares, setShares] = useState<ShareLink[] | null>(null);

    const refresh = useCallback(async () => {
        const list = await get<ShareLink[]>(conn, SHARES_PATH);
        if (list) setShares(list);
    }, [conn]);

    useEffect(() => {
        void refresh();
    }, [refresh]);
    useBroadcast(sharesUpdated, setShares);

    return { shares: shares ?? NONE, loading: shares === null, refresh };
}

/** Which sessions are on screen is plugin-side state with no broadcast of its
 *  own, so it is re-read whenever the session list moves. */
export function useShownSessions(sessions: IngestSession[]) {
    const conn = useSocket();
    const [shown, setShown] = useState<string[]>([]);

    const refresh = useCallback(async () => {
        const ids = await get<string[]>(conn, SHOWN_PATH);
        if (ids) setShown(ids);
    }, [conn]);

    useEffect(() => {
        void refresh();
    }, [refresh, sessions]);

    return { shown, refresh };
}
