import { useQuery } from '@tanstack/react-query';
import { noTryAsync } from 'no-try';
import { useTranslation } from 'next-i18next/pages';
import { useToast } from '../../components/ToastProvider';
import {
    entriesReordered,
    entryCreated,
    entryDeleted,
    entryUpdated,
} from '../api/broadcasts';
import { useBroadcast } from '../hooks/useBroadcast';
import { useSocket } from '../hooks/useSocket';
import { record } from '../undo/undoStore';
import { rundownScope } from '../undo/tools';
import { queryClient } from './client';
import { qk, qm } from './keys';
import {
    defineMutation,
    runMutation,
    useMutationSpec,
    type Rollback,
} from './mutations';
import { rundownRename, type Rundown, type RundownItem } from './rundowns';

export type RundownEntry = RundownItem;

export function useRundownEntriesQuery(id: string | null | undefined) {
    const conn = useSocket();
    return useQuery({
        queryKey: qk.rundownEntries(id ?? ''),
        enabled: !!id,
        queryFn: () => conn.rundowns.get(id as string),
    });
}

function reorderById<T extends { id: string }>(
    items: T[],
    order: string[],
): T[] {
    const byId = new Map(items.map(item => [item.id, item]));
    const reordered: T[] = [];
    for (const id of order) {
        const item = byId.get(id);
        if (!item) continue;
        reordered.push(item);
        byId.delete(id);
    }
    for (const item of byId.values()) reordered.push(item);
    return reordered;
}

/** Exists-guard for a per-rundown key: patching a never-fetched (or errored)
 *  key would fabricate a partial rundown that staleTime: Infinity then treats
 *  as complete — invalidate instead so an active observer refetches. */
function healIfUnfetched(id: string): boolean {
    const key = qk.rundownEntries(id);
    if (queryClient.getQueryData(key) !== undefined) return false;
    void queryClient.invalidateQueries({ queryKey: key });
    return true;
}

const cachedItems = (id: string): RundownEntry[] =>
    queryClient.getQueryData<Rundown>(qk.rundownEntries(id))?.items ?? [];

function patchItems(
    id: string,
    update: (items: RundownEntry[]) => RundownEntry[],
): void {
    // Mirror into the rundowns list too — /play renders item counts and type
    // chips off it, and with staleTime: Infinity it never refetches on its
    // own. `update` is pure, so applying it per key is safe.
    queryClient.setQueryData<Rundown[]>(qk.rundowns, prev =>
        prev?.map(r =>
            r.id === id ? { ...r, items: update(r.items ?? []) } : r,
        ),
    );

    if (healIfUnfetched(id)) return;
    queryClient.setQueryData<Rundown>(qk.rundownEntries(id), prev =>
        prev ? { ...prev, items: update(prev.items ?? []) } : prev,
    );
}

/** Every cache-patch function below returns the `Rollback` that undoes
 *  exactly what it just did, scoped to the one item/order it touched (not
 *  a whole-key snapshot) — so two of these in flight at once on the same
 *  rundown roll back independently instead of clobbering each other. */
export function insertEntryInCache(
    id: string,
    entry: RundownEntry,
    index?: number,
): Rollback {
    patchItems(id, items => {
        if (typeof index !== 'number') return [...items, entry];
        const next = [...items];
        next.splice(Math.max(0, Math.min(next.length, index)), 0, entry);
        return next;
    });
    return () => removeEntryFromCache(id, entry.id);
}

/** Replace-only, single entry or array batch: after an entry is deleted
 *  locally, a late UPDATE broadcast for it must not resurrect it. */
export function updateEntriesInCache(
    id: string,
    entry: RundownEntry | RundownEntry[],
): Rollback | void {
    if (Array.isArray(entry)) {
        const before = cachedItems(id);
        const beforeById = new Map(before.map(item => [item.id, item]));
        const updates = new Map(entry.map(item => [item.id, item]));
        patchItems(id, items =>
            items.map(item => updates.get(item.id) ?? item),
        );
        return () => {
            const prevEntries = entry
                .map(item => beforeById.get(item.id))
                .filter((item): item is RundownEntry => !!item);
            if (prevEntries.length) updateEntriesInCache(id, prevEntries);
        };
    }
    const before = cachedItems(id).find(item => item.id === entry.id);
    patchItems(id, items =>
        items.map(item => (item.id === entry.id ? entry : item)),
    );
    if (!before) return undefined;
    return () => updateEntriesInCache(id, before);
}

export function removeEntryFromCache(
    id: string,
    entryId: string,
): Rollback | void {
    const before = cachedItems(id).find(item => item.id === entryId);
    const index = cachedItems(id).findIndex(item => item.id === entryId);
    patchItems(id, items => items.filter(item => item.id !== entryId));
    if (!before) return undefined;
    return () => insertEntryInCache(id, before, index);
}

export function reorderEntriesInCache(id: string, order: string[]): Rollback {
    const before = cachedItems(id).map(item => item.id);
    patchItems(id, items => reorderById(items, order));
    return () => reorderEntriesInCache(id, before);
}

const entryKeys = (id: string) => [qk.rundowns, qk.rundownEntries(id)] as const;

interface EntryCreateVars {
    id: string;
    entry: RundownEntry;
    index?: number;
}
interface EntryUpdateVars {
    id: string;
    entry: RundownEntry;
}
interface EntryDeleteVars {
    id: string;
    entryId: string;
}
interface EntriesReorderVars {
    id: string;
    order: string[];
}

/** See `MutationSpec` for why these exist. `optimistic` applies the same
 *  cache patch as the old `patch` did, just before the request instead of
 *  after — entry ids are client-generated, so nothing here waits on the
 *  server. */
export const entryCreate = defineMutation<EntryCreateVars, void>({
    key: qm.entryCreate,
    keys: vars => entryKeys(vars.id),
    run: (api, vars) =>
        api.rundowns.createEntry(vars.id, vars.entry, vars.index),
    optimistic: vars => insertEntryInCache(vars.id, vars.entry, vars.index),
});

export const entryUpdate = defineMutation<EntryUpdateVars, void>({
    key: qm.entryUpdate,
    keys: vars => entryKeys(vars.id),
    run: (api, vars) => api.rundowns.updateEntry(vars.id, vars.entry),
    optimistic: vars => updateEntriesInCache(vars.id, vars.entry),
});

export const entryDelete = defineMutation<EntryDeleteVars, void>({
    key: qm.entryDelete,
    keys: vars => entryKeys(vars.id),
    run: (api, vars) => api.rundowns.deleteEntry(vars.id, vars.entryId),
    optimistic: vars => removeEntryFromCache(vars.id, vars.entryId),
});

export const entriesReorder = defineMutation<EntriesReorderVars, void>({
    key: qm.entriesReorder,
    keys: vars => entryKeys(vars.id),
    run: (api, vars) => api.rundowns.reorderEntries(vars.id, vars.order),
    optimistic: vars => reorderEntriesInCache(vars.id, vars.order),
});

/** Mounted once in QuerySync — global listeners addressed per rundown key, so
 *  background rundowns stay in sync too. The server excludes the originating
 *  client, so these only ever describe another client's mutation. */
export function useRundownEntriesSync(): void {
    useBroadcast(entryCreated, ({ id, entry, index }) =>
        insertEntryInCache(id, entry, index),
    );

    useBroadcast(entryUpdated, ({ id, entry }) =>
        updateEntriesInCache(id, entry),
    );

    useBroadcast(entryDeleted, ({ id, entry }) =>
        removeEntryFromCache(id, entry),
    );

    useBroadcast(entriesReordered, ({ id, order }) =>
        reorderEntriesInCache(id, order),
    );
}

/** Entry-level data + mutations for one rundown. Undo `apply` closures write
 *  through the queryClient singleton addressed by rundown id, so they stay
 *  correct after unmount or after the view switches to another rundown. */
export function useRundownEntries(rundownId: string | null | undefined) {
    const { t } = useTranslation('common');
    const notify = useToast();
    const { data } = useRundownEntriesQuery(rundownId);
    const create = useMutationSpec(entryCreate);
    const update = useMutationSpec(entryUpdate);
    const deleteMut = useMutationSpec(entryDelete);
    const rename = useMutationSpec(rundownRename);
    const reorder = useMutationSpec(entriesReorder);

    const name = data?.name ?? '';
    const entries = data?.items ?? [];

    const notifyFailure = (err: unknown, fallbackKey: string) =>
        notify((err as Error)?.message ?? t(fallbackKey), 'error');

    const createEntry = async (entry: RundownEntry, index?: number) => {
        if (!rundownId) return;
        const id = rundownId;
        const insertIndex =
            typeof index === 'number' ? index : cachedItems(id).length;
        const [err] = await noTryAsync(() =>
            create.mutateAsync({ id, entry, index }),
        );
        if (err) {
            notifyFailure(err, 'rundown.errors.createFailed');
            return;
        }

        record<RundownEntry | null>({
            label: { key: 'entryCreate', params: { title: entry.title } },
            scopes: [rundownScope(id, `entry:${entry.id}`)],
            prev: null,
            next: entry,
            apply: (state, { api }) =>
                state
                    ? runMutation(entryCreate, api, {
                          id,
                          entry: state,
                          index: insertIndex,
                      })
                    : runMutation(entryDelete, api, {
                          id,
                          entryId: entry.id,
                      }),
        });
    };

    const updateEntry = async (entry: RundownEntry) => {
        if (!rundownId) return;
        const id = rundownId;
        const before = cachedItems(id).find(v => v.id === entry.id);

        const [err] = await noTryAsync(() => update.mutateAsync({ id, entry }));
        if (err) {
            notifyFailure(err, 'rundown.errors.updateFailed');
            return;
        }
        if (!before) return;

        record({
            label: { key: 'entryUpdate', params: { title: entry.title } },
            scopes: [rundownScope(id, `entry:${entry.id}`)],
            prev: before,
            next: entry,
            apply: (state, { api }) =>
                runMutation(entryUpdate, api, { id, entry: state }),
        });
    };

    const deleteEntry = async (entry: RundownEntry) => {
        if (!rundownId) return;
        const id = rundownId;
        const index = cachedItems(id).findIndex(v => v.id === entry.id);

        const [err] = await noTryAsync(() =>
            deleteMut.mutateAsync({ id, entryId: entry.id }),
        );
        if (err) {
            notifyFailure(err, 'rundown.errors.deleteFailed');
            return;
        }
        if (index < 0) return;

        record<RundownEntry | null>({
            label: { key: 'entryDelete', params: { title: entry.title } },
            scopes: [rundownScope(id, `entry:${entry.id}`)],
            prev: entry,
            next: null,
            apply: (state, { api }) =>
                state
                    ? runMutation(entryCreate, api, {
                          id,
                          entry: state,
                          index,
                      })
                    : runMutation(entryDelete, api, {
                          id,
                          entryId: entry.id,
                      }),
        });
    };

    const renameRundown = async (newName: string) => {
        if (!rundownId) return;
        const id = rundownId;
        const trimmed = newName.trim();
        const before =
            queryClient.getQueryData<Rundown>(qk.rundownEntries(id))?.name ??
            '';
        if (!trimmed || trimmed === before) return;

        const [err] = await noTryAsync(() =>
            rename.mutateAsync({ id, name: trimmed }),
        );
        if (err) {
            notifyFailure(err, 'rundown.errors.renameFailed');
            return;
        }

        record({
            label: { key: 'rundownRename', params: { name: trimmed } },
            scopes: [rundownScope(id, 'name')],
            prev: before,
            next: trimmed,
            apply: (value, { api }) =>
                runMutation(rundownRename, api, { id, name: value }),
        });
    };

    const reorderEntries = async (orderedIds: string[]) => {
        if (!rundownId) return;
        const id = rundownId;
        const current = cachedItems(id);
        const before = current.map(item => item.id);
        if (
            before.length === orderedIds.length &&
            before.every((entryId, i) => entryId === orderedIds[i])
        )
            return;

        const after = reorderById(current, orderedIds).map(item => item.id);
        const [err] = await noTryAsync(() =>
            reorder.mutateAsync({ id, order: after }),
        );
        if (err) {
            notifyFailure(err, 'rundown.errors.reorderFailed');
            return;
        }

        record({
            label: { key: 'reorder' },
            scopes: [rundownScope(id, 'order')],
            prev: before,
            next: after,
            apply: (order, { api }) =>
                runMutation(entriesReorder, api, { id, order }),
        });
    };

    return {
        name,
        entries,

        updateEntry,
        deleteEntry,
        createEntry,
        reorderEntries,
        renameRundown,
    };
}
