import { useQuery } from '@tanstack/react-query';
import { useSocket } from '../hooks/useSocket';
import { queryClient } from './client';
import { qk } from './keys';
import { useWsBroadcast } from './useWsBroadcast';

export type { RundownActionDescriptor } from '../api/rundowns';

export function useRundownTypesQuery() {
    const conn = useSocket();
    return useQuery({
        queryKey: qk.rundownTypes,
        queryFn: () => conn.rundowns.getTypes(),
    });
}

export function useRundownActionsQuery() {
    const conn = useSocket();
    return useQuery({
        queryKey: qk.rundownActions,
        queryFn: () => conn.rundowns.getActions(),
    });
}

const invalidateMeta = () =>
    void queryClient.invalidateQueries({ queryKey: qk.rundownMeta });

/** Mounted once in QuerySync. Both signals mean the registered action set may
 *  have changed: CasparCG restarts make plugins re-register their actions,
 *  and plugin enable/disable unregisters actions by owner. Signal-only, so
 *  invalidate rather than patch. Both come through the shared broadcast
 *  dispatcher (alongside useCasparSync's and usePluginsSync's cache writes on
 *  the same topics). */
export function useRundownMetaSync(): void {
    const conn = useSocket();

    useWsBroadcast(conn, 'caspar/status', 'ACTION', invalidateMeta);
    useWsBroadcast(conn, 'plugins', 'ACTION', invalidateMeta);
}
