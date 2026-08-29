import { useMutation, useQuery } from '@tanstack/react-query';
import { type ManagerApi } from '../api/api';
import { assertOk, type MediaDoc } from '../api/caspar';
import { useSocket } from '../hooks/useSocket';
import { queryClient } from './client';
import { qk } from './keys';
import { useWsBroadcast } from './useWsBroadcast';

async function fetchMedia(conn: ManagerApi): Promise<Record<string, MediaDoc>> {
    const res = await conn.rawRequest('/api/caspar/media/all', 'GET', {});
    assertOk(res);

    const docs = (res.data as MediaDoc[]) ?? [];
    return Object.fromEntries(docs.map(doc => [doc.id, doc]));
}

async function fetchFolders(conn: ManagerApi): Promise<string[]> {
    const res = await conn.rawRequest('/api/caspar/media/folder', 'GET', {});
    assertOk(res);
    return (res.data as { folders?: string[] })?.folders ?? [];
}

export function useMediaDocsQuery(enabled = true) {
    const conn = useSocket();
    return useQuery({
        queryKey: qk.media,
        enabled: !!conn && enabled,
        queryFn: () => fetchMedia(conn as ManagerApi),
    });
}

/** Folders the user has created under the media root, as upper-cased
 *  prefixes with trailing slash. Tracked separately from the media docs
 *  because the scanner only indexes files — an empty folder would otherwise
 *  be invisible. */
export function useFoldersQuery() {
    const conn = useSocket();
    return useQuery({
        queryKey: qk.mediaFolders,
        enabled: !!conn,
        queryFn: () => fetchFolders(conn as ManagerApi),
    });
}

/** Exists-guard: a never-fetched (or errored) key must not be patched into a
 *  partial record that staleTime: Infinity would then treat as complete.
 *  Instead invalidate so an active observer refetches the real list. */
function healIfUnfetched(): boolean {
    if (queryClient.getQueryData(qk.media) !== undefined) return false;
    void queryClient.invalidateQueries({ queryKey: qk.media });
    return true;
}

function setMediaInCache(key: string, value: MediaDoc | null): void {
    if (healIfUnfetched()) return;
    queryClient.setQueryData<Record<string, MediaDoc>>(qk.media, prev => {
        if (!prev) return prev;
        if (!value) {
            if (!(key in prev)) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        }
        return { ...prev, [key]: value };
    });
}

/** The broadcast carries the complete list, so setting an unfetched key is
 *  safe — unlike the per-key media patches above. */
function setFoldersInCache(folders: string[]): void {
    queryClient.setQueryData(qk.mediaFolders, folders);
}

/** For the originating client after a folder mutation — the server excludes
 *  it from the `caspar/media/folder` broadcast, so it re-lists itself. */
export const refreshFolders = () =>
    void queryClient.invalidateQueries({ queryKey: qk.mediaFolders });

export class BulkDeleteError extends Error {
    constructor(
        readonly failed: number,
        readonly total: number,
    ) {
        super(`${failed} of ${total} deletes failed`);
    }
}

/** Raw wire mutations and their cache side-effects; the confirm-flow UX
 *  (busy, toasts, error messages) lives in useMediaHandlers. Media-doc
 *  mutations need no cache patch — the scanner broadcasts `caspar/media`
 *  per key to every client, originator included. */
export function useMediaMutations() {
    const conn = useSocket();
    const caspar = () => {
        if (!conn) throw new Error('not connected');
        return conn.caspar;
    };

    const deleteMedia = useMutation({
        mutationFn: (id: string) => caspar().deleteMedia(id),
    });

    const deleteManyMedia = useMutation({
        mutationFn: async (ids: string[]) => {
            const results = await Promise.allSettled(
                ids.map(id => caspar().deleteMedia(id)),
            );
            const failed = results.filter(r => r.status === 'rejected').length;
            if (failed > 0) throw new BulkDeleteError(failed, ids.length);
        },
    });

    const renameMedia = useMutation({
        mutationFn: ({ id, name }: { id: string; name: string }) =>
            caspar().renameMedia(id, name),
    });

    const moveMedia = useMutation({
        mutationFn: ({ from, to }: { from: string; to: string }) =>
            caspar().moveMedia(from, to),
    });

    const createFolder = useMutation({
        mutationFn: (path: string) => caspar().createFolder(path),
        onSuccess: refreshFolders,
    });

    const deleteFolder = useMutation({
        mutationFn: (vars: { path: string; recursive: boolean }) =>
            caspar().deleteFolder(vars.path, vars.recursive),
        onSuccess: refreshFolders,
    });

    const renameFolder = useMutation({
        mutationFn: ({ from, to }: { from: string; to: string }) =>
            caspar().renameFolder(from, to),
        onSuccess: refreshFolders,
    });

    return {
        deleteMedia,
        deleteManyMedia,
        renameMedia,
        moveMedia,
        createFolder,
        deleteFolder,
        renameFolder,
    };
}

/** Mounted once in QuerySync. `caspar/media` goes to ALL clients (originator
 *  included) — the scanner is the source of truth and the per-key set is
 *  idempotent, so there's no echo problem. This topic is only reachable
 *  because CasparServerApi no longer registers a raw REP route for it —
 *  REP dispatches to the first match, so don't reintroduce one there. */
export function useMediaSync(): void {
    const conn = useSocket();

    useWsBroadcast(conn, 'caspar/media', 'ACTION', data => {
        const { key, value } = data as {
            key?: string;
            value?: MediaDoc | null;
        };
        if (!key) return;
        setMediaInCache(key, value ?? null);
        // A media change can imply a folder-set change too (uploads mkdir
        // implicitly; deletes can empty a dir) — re-list while observed.
        refreshFolders();
    });

    useWsBroadcast(conn, 'caspar/media/folder', 'ACTION', data => {
        if (!Array.isArray(data)) return;
        setFoldersInCache(data as string[]);
    });
}
