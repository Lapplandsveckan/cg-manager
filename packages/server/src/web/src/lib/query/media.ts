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

export function useFoldersQuery() {
    const conn = useSocket();
    return useQuery({
        queryKey: qk.mediaFolders,
        queryFn: () => conn.caspar.getFolders(),
    });
}

// Never-fetched keys are invalidated, not patched: staleTime Infinity would freeze a partial list
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

function removeManyFromMediaCache(keys: string[]): void {
    if (!keys.length || healIfUnfetched()) return;
    queryClient.setQueryData<Record<string, MediaDoc>>(qk.media, prev => {
        if (!prev) return prev;
        const next = { ...prev };
        for (const key of keys) delete next[key];
        return next;
    });
}

function setFoldersInCache(folders: string[]): void {
    queryClient.setQueryData(qk.mediaFolders, folders);
}

function applyMediaMoveResult(
    oldId: string,
    res: { id: string; doc: MediaDoc | null },
): void {
    setMediaInCache(oldId, null);
    refreshFolders();

    if (!res.doc) {
        void queryClient.invalidateQueries({ queryKey: qk.media });
        return;
    }

    setMediaInCache(res.id, res.doc);
}

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

// Server excludes the requesting client from the caspar/media broadcast, so each mutation applies its own response
export function useMediaMutations() {
    const conn = useSocket();
    const caspar = () => conn.caspar;

    const deleteMedia = useMutation({
        mutationFn: (id: string) => caspar().deleteMedia(id),
        onSuccess: (res, id) => {
            removeManyFromMediaCache([id, res.id]);
            refreshFolders();
        },
    });

    const deleteManyMedia = useMutation({
        mutationFn: async (ids: string[]) => {
            const results = await Promise.allSettled(
                ids.map(id => caspar().deleteMedia(id)),
            );
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
            if (vars.recursive)
                void queryClient.invalidateQueries({ queryKey: qk.media });
        },
    });

    const renameFolder = useMutation({
        mutationFn: ({ from, to }: { from: string; to: string }) =>
            caspar().renameFolder(from, to),
        onSuccess: () => {
            refreshFolders();
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

export function useMediaSync(): void {
    useBroadcast(mediaChanged, ({ key, value }) => {
        setMediaInCache(key, value ?? null);
        refreshFolders();
    });

    useBroadcast(mediaFolders, setFoldersInCache);
}
