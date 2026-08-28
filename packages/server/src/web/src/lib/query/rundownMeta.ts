import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type ManagerApi } from '../api/api';
import { assertOk } from '../api/caspar';
import { useSocket } from '../hooks/useSocket';
import { queryClient } from './client';
import { qk } from './keys';

export interface RundownActionDescriptor {
    id: string;
    hasStop: boolean;
    acceptsFiles?: boolean;
    fileTypes?: string[];
    destination?: string;
}

async function fetchTypes(conn: ManagerApi): Promise<string[]> {
    const res = await conn.rawRequest('/api/rundown/types', 'GET', {});
    assertOk(res);
    return (res.data as string[]) ?? [];
}

async function fetchActions(
    conn: ManagerApi,
): Promise<RundownActionDescriptor[]> {
    const res = await conn.rawRequest('/api/rundown/actions', 'GET', {});
    assertOk(res);
    return (res.data as RundownActionDescriptor[]) ?? [];
}

export function useRundownTypesQuery() {
    const conn = useSocket();
    return useQuery({
        queryKey: qk.rundownTypes,
        enabled: !!conn,
        queryFn: () => fetchTypes(conn as ManagerApi),
    });
}

export function useRundownActionsQuery() {
    const conn = useSocket();
    return useQuery({
        queryKey: qk.rundownActions,
        enabled: !!conn,
        queryFn: () => fetchActions(conn as ManagerApi),
    });
}

const invalidateMeta = () =>
    void queryClient.invalidateQueries({ queryKey: qk.rundownMeta });

/** Mounted once in QuerySync. Both signals mean the registered action set may
 *  have changed: CasparCG restarts make plugins re-register their actions,
 *  and plugin enable/disable unregisters actions by owner. Signal-only, so
 *  invalidate rather than patch. Status must come via CasparServerApi's
 *  EventEmitter, not useWsBroadcast — the api constructor registers the raw
 *  'caspar/status' REP route first, which would shadow a dispatcher route. */
export function useRundownMetaSync(): void {
    const conn = useSocket();

    useEffect(() => {
        if (!conn) return;
        conn.caspar.on('status', invalidateMeta);
        conn.plugin.on('change', invalidateMeta);
        return () => {
            conn.caspar.off('status', invalidateMeta);
            conn.plugin.off('change', invalidateMeta);
        };
    }, [conn]);
}
