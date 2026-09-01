import { useMutation, useQuery } from '@tanstack/react-query';
import { type ManagerApi } from '../api/api';
import { mediaChanged, mediaFolders } from '../api/broadcasts';
import { type MediaDoc } from '../api/caspar';
import { useBroadcast } from '../hooks/useBroadcast';
import { useSocket } from '../hooks/useSocket';
import { queryClient } from './client';
import { qk } from './keys';

async function fetchMedia(conn: ManagerApi): Promise<Record<string, MediaDoc>> {
    const docs = await conn.caspar.getAllMedia();
    return Object.fromEntries(docs.map(doc => [doc.id, doc]));
}

export function useMediaDocsQuery(enabled = true) {
    const conn = useSocket();
    return useQuery({
        queryKey: qk.media,
        enabled,
        queryFn: () => fetchMedia(conn),
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
        queryFn: () => conn.caspar.getFolders(),
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

/** Drop several ids in one cache write, e.g. after a bulk delete — avoids a
 *  setQueryData (and re-render) per id. */
function removeManyFromMediaCache(keys: string[]): void {
    if (!keys.length || healIfUnfetched()) return;
    queryClient.setQueryData<Record<string, MediaDoc>>(qk.media, prev => {
        if (!prev) return prev;
        const next = { ...prev };
        for (const key of keys) delete next[key];
        return next;
    });
}

/** The broadcast carries the complete list, so setting an unfetched key is
 *  safe — unlike the per-key media patches above. */
function setFoldersInCache(folders: string[]): void {
    queryClient.setQueryData(qk.mediaFolders, folders);
}

/** Apply a rename/move response: drop the old id, patch in the new doc. A
 *  `null` doc means the scanner couldn't re-probe the file at its new path
 *  (rare — e.g. it became unparseable mid-move); fall back to a refetch
 *  rather than leave the cache missing an entry the server still has. */
function applyMediaMoveResult(
    oldId: string,
    res: { id: string; doc: MediaDoc | null },
): void {
    // A move can create a folder (fs.mkdir recursive) or empty one out; this
    // client is excluded from the caspar/media broadcast that would
    // otherwise trigger useMediaSync's refreshFolders(), so do it here too.
    setMediaInCache(oldId, null);
    refreshFolders();

    if (!res.doc) {
        void queryClient.invalidateQueries({ queryKey: qk.media });
        return;
    }

    setMediaInCache(res.id, res.doc);
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
 *  (busy, toasts, error messages) lives in useMediaHandlers. The server
 *  excludes the requesting client from `caspar/media` (see media route
 *  handlers) so each mutation applies its own response here instead of
 *  waiting for the broadcast — other clients still get it as normal. */
export function useMediaMutations() {
    const conn = useSocket();
    const caspar = () => conn.caspar;

    const deleteMedia = useMutation({
        mutationFn: (id: string) => caspar().deleteMedia(id),
        onSuccess: (res, id) => {
            // Drop the requested id as well as the one the server removed.
            // They normally match, but a doc whose mediaPath has drifted from
            // its id resolves to a different id server-side — and with this
            // client excluded from the broadcast, nothing would ever correct
            // the leftover entry.
            removeManyFromMediaCache([id, res.id]);
            // A delete can empty out a folder; this client is excluded from
            // the caspar/media broadcast that would otherwise trigger
            // useMediaSync's refreshFolders(), so do it here too.
            refreshFolders();
        },
    });

    const deleteManyMedia = useMutation({
        mutationFn: async (ids: string[]) => {
            const results = await Promise.allSettled(
                ids.map(id => caspar().deleteMedia(id)),
            );
            // Both ids per success, for the same reason as deleteMedia above.
            // Patched here rather than in onSuccess because a partial failure
            // throws below — the deletes that did land must still be applied.
            const deletedIds = results.flatMap((res, index) =>
                res.status === 'fulfilled' ? [ids[index], res.value.id] : [],
            );
            removeManyFromMediaCache(deletedIds);
            if (deletedIds.length) refreshFolders();

            const failed = results.filter(r => r.status === 'rejected').length;
            if (failed > 0) throw new BulkDeleteError(failed, ids.length);
        },
    });

    const renameMedia = useMutation({
        mutationFn: ({ id, name }: { id: string; name: string }) =>
            caspar().renameMedia(id, name),
        onSuccess: (res, { id }) => applyMediaMoveResult(id, res),
    });

    const moveMedia = useMutation({
        mutationFn: ({ from, to }: { from: string; to: string }) =>
            caspar().moveMedia(from, to),
        onSuccess: (res, { from }) => applyMediaMoveResult(from, res),
    });

    const createFolder = useMutation({
        mutationFn: (path: string) => caspar().createFolder(path),
        onSuccess: refreshFolders,
    });

    const deleteFolder = useMutation({
        mutationFn: (vars: { path: string; recursive: boolean }) =>
            caspar().deleteFolder(vars.path, vars.recursive),
        onSuccess: (_res, vars) => {
            refreshFolders();
            // A recursive delete removes every media doc under the folder —
            // the route reconciles them server-side, but this client is
            // excluded from the broadcast, so re-list to pick them up.
            if (vars.recursive)
                void queryClient.invalidateQueries({ queryKey: qk.media });
        },
    });

    const renameFolder = useMutation({
        mutationFn: ({ from, to }: { from: string; to: string }) =>
            caspar().renameFolder(from, to),
        onSuccess: () => {
            refreshFolders();
            // Every media doc under the folder gets a new id server-side;
            // this client is excluded from the per-key broadcasts, so re-list.
            void queryClient.invalidateQueries({ queryKey: qk.media });
        },
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

/** Mounted once in QuerySync. `caspar/media` reaches every client EXCEPT the
 *  one whose own request caused the change — that client applies the
 *  mutation's response instead (see useMediaMutations). So this only ever
 *  handles other clients' changes and filesystem-driven ones. */
export function useMediaSync(): void {
    useBroadcast(mediaChanged, ({ key, value }) => {
        setMediaInCache(key, value ?? null);
        // A media change can imply a folder-set change too (uploads mkdir
        // implicitly; deletes can empty a dir) — re-list while observed.
        refreshFolders();
    });

    useBroadcast(mediaFolders, setFoldersInCache);
}
