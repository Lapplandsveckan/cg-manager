import { useQuery } from '@tanstack/react-query';
import { type ManagerApi } from '../api/api';
import { assertOk } from '../api/caspar';
import { useSocket } from '../hooks/useSocket';
import { record } from '../undo/undoStore';
import { request, requestOk, rundownScope } from '../undo/tools';
import { queryClient } from './client';
import { qk } from './keys';
import {
    renameRundownInCache,
    type Rundown,
    type RundownItem,
} from './rundowns';
import { useWsBroadcast } from './useWsBroadcast';

export type RundownEntry = RundownItem;

async function fetchRundown(conn: ManagerApi, id: string): Promise<Rundown> {
    const res = await conn.rawRequest(`/api/rundown/${id}`, 'GET', {});
    assertOk(res);
    // The server replies 200 with a null body for an unknown id; TanStack
    // rejects undefined query data, so degrade to an empty rundown instead.
    return (res.data as Rundown) ?? { id, name: '', items: [] };
}

export function useRundownEntriesQuery(id: string | null | undefined) {
    const conn = useSocket();
    return useQuery({
        queryKey: qk.rundownEntries(id ?? ''),
        enabled: !!conn && !!id,
        queryFn: () => fetchRundown(conn as ManagerApi, id as string),
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
    const conn = useSocket();
    const { data } = useRundownEntriesQuery(rundownId);

    const name = data?.name ?? '';
    const entries = data?.items ?? [];

    const createEntry = async (entry: RundownEntry, index?: number) => {
        if (!conn || !rundownId) return;
        const id = rundownId;
        const insertIndex =
            typeof index === 'number' ? index : cachedItems(id).length;
        const ok = await requestOk(
            conn,
            `/api/rundown/${id}/entry`,
            'CREATE',
            typeof index === 'number' ? { entry, index } : entry,
        );
        if (!ok) return;

        insertEntryInCache(id, entry, index);
        record<RundownEntry | null>({
            label: { key: 'entryCreate', params: { title: entry.title } },
            scopes: [rundownScope(id, `entry:${entry.id}`)],
            prev: null,
            next: entry,
            apply: async (state, { api }) => {
                if (state) {
                    await request(api, {
                        path: `/api/rundown/${id}/entry`,
                        method: 'CREATE',
                        data: { entry: state, index: insertIndex },
                    });
                    insertEntryInCache(id, state, insertIndex);
                    return;
                }
                await request(api, {
                    path: `/api/rundown/${id}/entry`,
                    method: 'DELETE',
                    data: entry.id,
                });
                removeEntryFromCache(id, entry.id);
            },
        });
    };

    const updateEntry = async (entry: RundownEntry) => {
        if (!conn || !rundownId) return;
        const id = rundownId;
        const before = cachedItems(id).find(v => v.id === entry.id);

        const ok = await requestOk(
            conn,
            `/api/rundown/${id}/entry`,
            'UPDATE',
            entry,
        );
        if (!ok) return;

        updateEntriesInCache(id, entry);
        if (!before) return;
        record({
            label: { key: 'entryUpdate', params: { title: entry.title } },
            scopes: [rundownScope(id, `entry:${entry.id}`)],
            prev: before,
            next: entry,
            apply: async (state, { api }) => {
                await request(api, {
                    path: `/api/rundown/${id}/entry`,
                    method: 'UPDATE',
                    data: state,
                });
                updateEntriesInCache(id, state);
            },
        });
    };

    const deleteEntry = async (entry: RundownEntry) => {
        if (!conn || !rundownId) return;
        const id = rundownId;
        const index = cachedItems(id).findIndex(v => v.id === entry.id);

        const ok = await requestOk(
            conn,
            `/api/rundown/${id}/entry`,
            'DELETE',
            entry.id,
        );
        if (!ok) return;
        if (index < 0) return;

        removeEntryFromCache(id, entry.id);
        record<RundownEntry | null>({
            label: { key: 'entryDelete', params: { title: entry.title } },
            scopes: [rundownScope(id, `entry:${entry.id}`)],
            prev: entry,
            next: null,
            apply: async (state, { api }) => {
                if (state) {
                    await request(api, {
                        path: `/api/rundown/${id}/entry`,
                        method: 'CREATE',
                        data: { entry: state, index },
                    });
                    insertEntryInCache(id, state, index);
                    return;
                }
                await request(api, {
                    path: `/api/rundown/${id}/entry`,
                    method: 'DELETE',
                    data: entry.id,
                });
                removeEntryFromCache(id, entry.id);
            },
        });
    };

    const renameRundown = async (newName: string) => {
        if (!conn || !rundownId) return;
        const id = rundownId;
        const trimmed = newName.trim();
        const before =
            queryClient.getQueryData<Rundown>(qk.rundownEntries(id))?.name ??
            '';
        if (!trimmed || trimmed === before) return;

        const ok = await requestOk(
            conn,
            `/api/rundown/${id}`,
            'UPDATE',
            trimmed,
        );
        if (!ok) return;

        renameRundownInCache(id, trimmed);
        record({
            label: { key: 'rundownRename', params: { name: trimmed } },
            scopes: [rundownScope(id, 'name')],
            prev: before,
            next: trimmed,
            apply: async (value, { api }) => {
                await request(api, {
                    path: `/api/rundown/${id}`,
                    method: 'UPDATE',
                    data: value,
                });
                renameRundownInCache(id, value);
            },
        });
    };

    const reorderEntries = async (orderedIds: string[]) => {
        if (!conn || !rundownId) return;
        const id = rundownId;
        const current = cachedItems(id);
        const before = current.map(item => item.id);
        if (
            before.length === orderedIds.length &&
            before.every((entryId, i) => entryId === orderedIds[i])
        )
            return;

        const after = reorderById(current, orderedIds).map(item => item.id);
        const ok = await requestOk(
            conn,
            `/api/rundown/${id}/order`,
            'ACTION',
            after,
        );
        if (!ok) return;

        reorderEntriesInCache(id, after);
        record({
            label: { key: 'reorder' },
            scopes: [rundownScope(id, 'order')],
            prev: before,
            next: after,
            apply: async (order, { api }) => {
                await request(api, {
                    path: `/api/rundown/${id}/order`,
                    method: 'ACTION',
                    data: order,
                });
                reorderEntriesInCache(id, order);
            },
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
