import { useQuery } from '@tanstack/react-query';
import { noTryAsync } from 'no-try';
import { type ManagerApi } from '../api/api';
import type { Rundown, RundownItem } from '../api/rundowns';
import { useSocket } from '../hooks/useSocket';
import { record, recordBarrier } from '../undo/undoStore';
import { rundownScope } from '../undo/tools';
import { queryClient } from './client';
import { qk } from './keys';
import { useWsBroadcast } from './useWsBroadcast';

export type { Rundown, RundownItem };

/** The server splits the GET endpoints by type; the cache holds ALL rundowns
 *  under one key and the list hooks below filter via select. */
async function fetchRundowns(conn: ManagerApi): Promise<Rundown[]> {
    const [main, quick] = await Promise.all([
        conn.rundowns.list(),
        conn.rundowns.listQuick(),
    ]);
    return [...main, ...quick];
}

const isQuick = (rundown: Rundown) => rundown.type === 'quick';
const selectRundowns = (rundowns: Rundown[]) =>
    rundowns.filter(r => !isQuick(r));
const selectQuickActions = (rundowns: Rundown[]) => rundowns.filter(isQuick);

function useRundownsQueryWith(select?: (rundowns: Rundown[]) => Rundown[]) {
    const conn = useSocket();
    return useQuery({
        queryKey: qk.rundowns,
        queryFn: () => fetchRundowns(conn),
        select,
    });
}

export const useRundownsQuery = () => useRundownsQueryWith();
export const useRundownList = () => useRundownsQueryWith(selectRundowns);
export const useQuickActionsList = () =>
    useRundownsQueryWith(selectQuickActions);

/** Exists-guard: a never-fetched (or errored) key must not be patched into a
 *  partial list that staleTime: Infinity would then treat as complete.
 *  Instead invalidate so an active observer refetches the real list. */
function healIfUnfetched(): boolean {
    if (queryClient.getQueryData(qk.rundowns) !== undefined) return false;
    void queryClient.invalidateQueries({ queryKey: qk.rundowns });
    return true;
}

export function upsertRundownInCache(rundown: Rundown): void {
    if (healIfUnfetched()) return;
    queryClient.setQueryData<Rundown[]>(qk.rundowns, prev => {
        if (!prev) return prev;
        const exists = prev.some(r => r.id === rundown.id);
        return exists
            ? prev.map(r => (r.id === rundown.id ? rundown : r))
            : [...prev, rundown];
    });
}

/** Renames in the list AND in the per-rundown entries cache, so the open
 *  rundown view and the list can never disagree on the name. Replace-only in
 *  both — a late UPDATE broadcast must not resurrect a deleted rundown. */
export function renameRundownInCache(id: string, name: string): void {
    if (!healIfUnfetched())
        queryClient.setQueryData<Rundown[]>(qk.rundowns, prev =>
            prev?.map(r => (r.id === id ? { ...r, name } : r)),
        );

    const entriesKey = qk.rundownEntries(id);
    if (queryClient.getQueryData(entriesKey) === undefined) {
        void queryClient.invalidateQueries({ queryKey: entriesKey });
        return;
    }
    queryClient.setQueryData<Rundown>(entriesKey, prev =>
        prev ? { ...prev, name } : prev,
    );
}

export function removeRundownFromCache(id: string): void {
    queryClient.removeQueries({ queryKey: qk.rundownEntries(id) });
    if (healIfUnfetched()) return;
    queryClient.setQueryData<Rundown[]>(qk.rundowns, prev =>
        prev?.filter(r => r.id !== id),
    );
}

/** Mounted once in QuerySync. The server excludes the originating client from
 *  these broadcasts, so they only ever describe another client's mutation. */
export function useRundownsSync(): void {
    const conn = useSocket();

    useWsBroadcast(conn, 'rundown', 'CREATE', data => {
        const rundown = data as Rundown;
        if (!rundown?.id) return;
        upsertRundownInCache(rundown);
    });

    useWsBroadcast(conn, 'rundown', 'UPDATE', data => {
        const { id, name } = data as { id?: string; name?: string };
        if (!id || typeof name !== 'string') return;
        renameRundownInCache(id, name);
    });

    useWsBroadcast(conn, 'rundown', 'DELETE', data => {
        if (typeof data !== 'string') return;
        removeRundownFromCache(data);
    });
}

/** Create/rename/delete for whole rundowns. `type` selects the quick-action
 *  variants (create path and undo labels); rename/delete are shared. */
export function useRundownMutations(type: 'rundown' | 'quick') {
    const conn = useSocket();

    const updateRundown = async (entry: Rundown) => {
        const rundowns = queryClient.getQueryData<Rundown[]>(qk.rundowns);
        const before = rundowns?.find(v => v.id === entry.id);

        const [err] = await noTryAsync(() =>
            conn.rundowns.rename(entry.id, entry.name),
        );
        if (err) return;

        renameRundownInCache(entry.id, entry.name);
        if (!before) return;
        record({
            label: {
                key: type === 'quick' ? 'quickRename' : 'rundownRename',
                params: { name: entry.name },
            },
            scopes: [rundownScope(entry.id, 'name')],
            prev: before.name,
            next: entry.name,
            apply: async (name, { api }) => {
                await api.rundowns.rename(entry.id, name);
                renameRundownInCache(entry.id, name);
            },
        });
    };

    const deleteRundown = async (entry: Rundown) => {
        const [err] = await noTryAsync(() => conn.rundowns.delete(entry.id));
        if (err) return;

        removeRundownFromCache(entry.id);
        recordBarrier({ key: 'rundownDelete', params: { name: entry.name } }, [
            rundownScope(entry.id),
        ]);
    };

    const createRundown = async (name: string): Promise<Rundown | null> => {
        const [err, data] = await noTryAsync(() =>
            type === 'quick'
                ? conn.rundowns.createQuick(name)
                : conn.rundowns.create(name),
        );
        if (err || !data) return null;

        upsertRundownInCache(data);
        recordBarrier(
            {
                key: type === 'quick' ? 'quickCreate' : 'rundownCreate',
                params: { name: data.name },
            },
            [rundownScope(data.id)],
        );
        return data;
    };

    return { updateRundown, deleteRundown, createRundown };
}
