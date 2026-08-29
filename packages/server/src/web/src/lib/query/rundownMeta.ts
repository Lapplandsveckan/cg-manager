import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type ManagerApi } from '../api/api';
import { useSocket } from '../hooks/useSocket';
import { queryClient } from './client';
import { qk } from './keys';
import { useWsBroadcast } from './useWsBroadcast';

export interface RundownActionDescriptor {
    id: string;
    hasStop: boolean;
    acceptsFiles?: boolean;
    fileTypes?: string[];
    destination?: string;
}

async function fetchTypes(conn: ManagerApi): Promise<string[]> {
    const res = await conn.rawRequest('/api/rundown/types', 'GET', {});
    return (res.data as string[]) ?? [];
}

async function fetchActions(
    conn: ManagerApi,
): Promise<RundownActionDescriptor[]> {
    const res = await conn.rawRequest('/api/rundown/actions', 'GET', {});
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
 *  invalidate rather than patch. Status comes through the shared broadcast
 *  dispatcher (alongside useCasparSync's cache write); plugin change is
 *  still an EventEmitter signal until PR 5. */
export function useRundownMetaSync(): void {
    const conn = useSocket();

    useWsBroadcast(conn, 'caspar/status', 'ACTION', invalidateMeta);

    useEffect(() => {
        if (!conn) return;
        conn.plugin.on('change', invalidateMeta);
        return () => {
            conn.plugin.off('change', invalidateMeta);
        };
    }, [conn]);
}
