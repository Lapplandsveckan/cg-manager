import { useQuery } from '@tanstack/react-query';
import { noTryAsync } from 'no-try';
import { useSocket } from '../hooks/useSocket';
import { record } from '../undo/undoStore';
import { rundownScope } from '../undo/tools';
import { queryClient } from './client';
import { qk, qm } from './keys';
import { defineMutation, runMutation, useMutationSpec } from './mutations';
import { rundownRename, type Rundown, type RundownItem } from './rundowns';
import { useWsBroadcast } from './useWsBroadcast';

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

export function insertEntryInCache(
    id: string,
    entry: RundownEntry,
    index?: number,
): void {
    patchItems(id, items => {
        if (typeof index !== 'number') return [...items, entry];
        const next = [...items];
        next.splice(Math.max(0, Math.min(next.length, index)), 0, entry);
        return next;
    });
}

/** Replace-only, single entry or array batch: after an entry is deleted
 *  locally, a late UPDATE broadcast for it must not resurrect it. */
export function updateEntriesInCache(
    id: string,
    entry: RundownEntry | RundownEntry[],
): void {
    if (Array.isArray(entry)) {
        const updates = new Map(entry.map(item => [item.id, item]));
        patchItems(id, items =>
            items.map(item => updates.get(item.id) ?? item),
        );
        return;
    }
    patchItems(id, items =>
        items.map(item => (item.id === entry.id ? entry : item)),
    );
}

export function removeEntryFromCache(id: string, entryId: string): void {
    patchItems(id, items => items.filter(item => item.id !== entryId));
}

export function reorderEntriesInCache(id: string, order: string[]): void {
    patchItems(id, items => reorderById(items, order));
}

/** See `MutationSpec` for why these exist. */
export const entryCreate = defineMutation({
    key: qm.entryCreate,
    run: (api, vars: { id: string; entry: RundownEntry; index?: number }) =>
        api.rundowns.createEntry(vars.id, vars.entry, vars.index),
    patch: (_result, vars) =>
        insertEntryInCache(vars.id, vars.entry, vars.index),
});

export const entryUpdate = defineMutation({
    key: qm.entryUpdate,
    run: (api, vars: { id: string; entry: RundownEntry }) =>
        api.rundowns.updateEntry(vars.id, vars.entry),
    patch: (_result, vars) => updateEntriesInCache(vars.id, vars.entry),
});

export const entryDelete = defineMutation({
    key: qm.entryDelete,
    run: (api, vars: { id: string; entryId: string }) =>
        api.rundowns.deleteEntry(vars.id, vars.entryId),
    patch: (_result, vars) => removeEntryFromCache(vars.id, vars.entryId),
});

export const entriesReorder = defineMutation({
    key: qm.entriesReorder,
    run: (api, vars: { id: string; order: string[] }) =>
        api.rundowns.reorderEntries(vars.id, vars.order),
    patch: (_result, vars) => reorderEntriesInCache(vars.id, vars.order),
});

/** Mounted once in QuerySync — global listeners addressed per rundown key, so
 *  background rundowns stay in sync too. The server excludes the originating
 *  client, so these only ever describe another client's mutation. */
export function useRundownEntriesSync(): void {
    const conn = useSocket();

    useWsBroadcast(conn, 'rundown/entry', 'CREATE', data => {
        const { id, entry, index } = data as {
            id?: string;
            entry?: RundownEntry;
            index?: number;
        };
        if (!id || !entry?.id) return;
        insertEntryInCache(id, entry, index);
    });

    useWsBroadcast(conn, 'rundown/entry', 'UPDATE', data => {
        const { id, entry } = data as {
            id?: string;
            entry?: RundownEntry | RundownEntry[];
        };
        if (!id || !entry) return;
        updateEntriesInCache(id, entry);
    });

    useWsBroadcast(conn, 'rundown/entry', 'DELETE', data => {
        const { id, entry } = data as { id?: string; entry?: string };
        if (!id || typeof entry !== 'string') return;
        removeEntryFromCache(id, entry);
    });

    useWsBroadcast(conn, 'rundown/order', 'ACTION', data => {
        const { id, order } = data as { id?: string; order?: string[] };
        if (!id || !Array.isArray(order)) return;
        reorderEntriesInCache(id, order);
    });
}

const cachedItems = (id: string): RundownEntry[] =>
    queryClient.getQueryData<Rundown>(qk.rundownEntries(id))?.items ?? [];

/** Entry-level data + mutations for one rundown. Undo `apply` closures write
 *  through the queryClient singleton addressed by rundown id, so they stay
 *  correct after unmount or after the view switches to another rundown. */
export function useRundownEntries(rundownId: string | null | undefined) {
    const { data } = useRundownEntriesQuery(rundownId);
    const create = useMutationSpec(entryCreate);
    const update = useMutationSpec(entryUpdate);
    const deleteMut = useMutationSpec(entryDelete);
    const rename = useMutationSpec(rundownRename);
    const reorder = useMutationSpec(entriesReorder);

    const name = data?.name ?? '';
    const entries = data?.items ?? [];

    const createEntry = async (entry: RundownEntry, index?: number) => {
        if (!rundownId) return;
        const id = rundownId;
        const insertIndex =
            typeof index === 'number' ? index : cachedItems(id).length;
        const [err] = await noTryAsync(() =>
            create.mutateAsync({ id, entry, index }),
        );
        if (err) return;

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
        if (err) return;
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
        if (err) return;
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
        if (err) return;

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
        if (err) return;

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
