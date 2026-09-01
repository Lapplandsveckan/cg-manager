import { useQuery } from '@tanstack/react-query';
import { noTryAsync } from 'no-try';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../components/ToastProvider';
import { type ManagerApi } from '../api/api';
import type { Rundown, RundownItem } from '../api/rundowns';
import {
    rundownCreated,
    rundownDeleted,
    rundownRenamed,
} from '../api/broadcasts';
import { useBroadcast } from '../hooks/useBroadcast';
import { useSocket } from '../hooks/useSocket';
import { record, recordBarrier } from '../undo/undoStore';
import { rundownScope } from '../undo/tools';
import { queryClient } from './client';
import { qk, qm } from './keys';
import {
    defineMutation,
    runMutation,
    useMutationSpec,
    type Rollback,
} from './mutations';

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
 *  both — a late UPDATE broadcast must not resurrect a deleted rundown.
 *  Returns the `Rollback` to the pre-rename name (from whichever key still
 *  had it), for the same reason as `insertEntryInCache` et al. */
export function renameRundownInCache(
    id: string,
    name: string,
): Rollback | void {
    const beforeList = queryClient
        .getQueryData<Rundown[]>(qk.rundowns)
        ?.find(r => r.id === id)?.name;
    if (!healIfUnfetched())
        queryClient.setQueryData<Rundown[]>(qk.rundowns, prev =>
            prev?.map(r => (r.id === id ? { ...r, name } : r)),
        );

    const entriesKey = qk.rundownEntries(id);
    const beforeEntries = queryClient.getQueryData<Rundown>(entriesKey)?.name;
    if (beforeEntries === undefined) {
        void queryClient.invalidateQueries({ queryKey: entriesKey });
    } else {
        queryClient.setQueryData<Rundown>(entriesKey, prev =>
            prev ? { ...prev, name } : prev,
        );
    }

    const before = beforeList ?? beforeEntries;
    if (before === undefined) return undefined;
    return () => renameRundownInCache(id, before);
}

/** List-only removal — the `Rundown` it removed, so a caller (an optimistic
 *  rollback) can hand it straight to `upsertRundownInCache` to put it back. */
function removeRundownFromList(id: string): Rundown | undefined {
    if (healIfUnfetched()) return undefined;
    const removed = queryClient
        .getQueryData<Rundown[]>(qk.rundowns)
        ?.find(r => r.id === id);
    queryClient.setQueryData<Rundown[]>(qk.rundowns, prev =>
        prev?.filter(r => r.id !== id),
    );
    return removed;
}

export function removeRundownFromCache(id: string): void {
    queryClient.removeQueries({ queryKey: qk.rundownEntries(id) });
    removeRundownFromList(id);
}

/** Mounted once in QuerySync. The server excludes the originating client from
 *  these broadcasts, so they only ever describe another client's mutation. */
export function useRundownsSync(): void {
    useBroadcast(rundownCreated, upsertRundownInCache);
    useBroadcast(rundownRenamed, ({ id, name }) =>
        renameRundownInCache(id, name),
    );
    useBroadcast(rundownDeleted, removeRundownFromCache);
}

const rundownKeys = (id: string) =>
    [qk.rundowns, qk.rundownEntries(id)] as const;

interface RundownRenameVars {
    id: string;
    name: string;
}
interface RundownDeleteVars {
    id: string;
}

/** See `MutationSpec` for why these exist. */
export const rundownRename = defineMutation<RundownRenameVars, Rundown>({
    key: qm.rundownRename,
    keys: vars => rundownKeys(vars.id),
    run: (api, vars) => api.rundowns.rename(vars.id, vars.name),
    optimistic: vars => renameRundownInCache(vars.id, vars.name),
});

export const rundownDelete = defineMutation<RundownDeleteVars, void>({
    key: qm.rundownDelete,
    keys: vars => rundownKeys(vars.id),
    run: (api, vars) => api.rundowns.delete(vars.id),
    // Filter the list only — `removeQueries` on `rundownEntries(id)` has to
    // wait for `patch` (server-confirmed): with an active observer on that
    // key (e.g. QuickActions viewing the doomed rundown), removing it
    // optimistically triggers an immediate refetch that still succeeds
    // pre-delete and repopulates the cache with nothing left to clean it up.
    optimistic: vars => {
        const removed = removeRundownFromList(vars.id);
        if (!removed) return undefined;
        return () => upsertRundownInCache(removed);
    },
    patch: (_result, vars) => removeRundownFromCache(vars.id),
});

export const rundownCreate = defineMutation({
    key: qm.rundownCreate,
    run: (api, vars: { name: string; type: 'rundown' | 'quick' }) =>
        vars.type === 'quick'
            ? api.rundowns.createQuick(vars.name)
            : api.rundowns.create(vars.name),
    patch: result => upsertRundownInCache(result),
});

/** Create/rename/delete for whole rundowns. `type` selects the quick-action
 *  variants (create path and undo labels); rename/delete are shared. */
export function useRundownMutations(type: 'rundown' | 'quick') {
    const { t } = useTranslation('common');
    const notify = useToast();
    const rename = useMutationSpec(rundownRename);
    const deleteMut = useMutationSpec(rundownDelete);
    const create = useMutationSpec(rundownCreate);

    const notifyFailure = (err: unknown, fallbackKey: string) =>
        notify((err as Error)?.message ?? t(fallbackKey), 'error');

    const updateRundown = async (entry: Rundown) => {
        const rundowns = queryClient.getQueryData<Rundown[]>(qk.rundowns);
        const before = rundowns?.find(v => v.id === entry.id);

        const [err] = await noTryAsync(() =>
            rename.mutateAsync({ id: entry.id, name: entry.name }),
        );
        if (err) {
            notifyFailure(err, 'rundown.errors.renameFailed');
            return;
        }

        if (!before) return;
        record({
            label: {
                key: type === 'quick' ? 'quickRename' : 'rundownRename',
                params: { name: entry.name },
            },
            scopes: [rundownScope(entry.id, 'name')],
            prev: before.name,
            next: entry.name,
            apply: (name, { api }) =>
                runMutation(rundownRename, api, { id: entry.id, name }),
        });
    };

    const deleteRundown = async (entry: Rundown) => {
        const [err] = await noTryAsync(() =>
            deleteMut.mutateAsync({ id: entry.id }),
        );
        if (err) {
            notifyFailure(err, 'rundown.errors.deleteFailed');
            return;
        }

        recordBarrier({ key: 'rundownDelete', params: { name: entry.name } }, [
            rundownScope(entry.id),
        ]);
    };

    const createRundown = async (name: string): Promise<Rundown | null> => {
        const [err, data] = await noTryAsync(() =>
            create.mutateAsync({ name, type }),
        );
        if (err || !data) return null;

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
