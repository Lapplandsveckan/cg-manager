import { useQuery } from '@tanstack/react-query';
import type { VideoRoute } from '../api/videoRoutes';
import { useSocket } from '../hooks/useSocket';
import { queryClient } from './client';
import { qk, qm } from './keys';
import { defineMutation } from './mutations';
import { useWsBroadcast } from './useWsBroadcast';

export function useRoutesQuery() {
    const conn = useSocket();
    return useQuery({
        queryKey: qk.routes,
        queryFn: () => conn.videoRoutes.list(),
    });
}

/** Exists-guard: a never-fetched (or errored) key must not be patched into a
 *  partial list that staleTime: Infinity would then treat as complete.
 *  Instead invalidate so an active observer refetches the real list. */
function healIfUnfetched(): boolean {
    if (queryClient.getQueryData(qk.routes) !== undefined) return false;
    void queryClient.invalidateQueries({ queryKey: qk.routes });
    return true;
}

export function mergeRouteInCache(route: VideoRoute): void {
    if (healIfUnfetched()) return;
    queryClient.setQueryData<VideoRoute[]>(qk.routes, prev => {
        if (!prev) return prev;
        const exists = prev.some(r => r.id === route.id);
        return exists
            ? prev.map(r => (r.id === route.id ? route : r))
            : [...prev, route];
    });
}

/** Replace-only, for UPDATE broadcasts: after we delete a route locally, a
 *  late UPDATE broadcast for it must not resurrect it in the cache. */
function replaceRouteInCache(route: VideoRoute): void {
    if (healIfUnfetched()) return;
    queryClient.setQueryData<VideoRoute[]>(qk.routes, prev =>
        prev?.map(r => (r.id === route.id ? route : r)),
    );
}

export function removeRouteFromCache(id: string): void {
    if (healIfUnfetched()) return;
    queryClient.setQueryData<VideoRoute[]>(qk.routes, prev =>
        prev?.filter(r => r.id !== id),
    );
}

/** See `MutationSpec` for why these exist. */
export const routeCreate = defineMutation({
    key: qm.routeCreate,
    run: (api, vars: Omit<VideoRoute, 'id'>) => api.videoRoutes.create(vars),
    patch: mergeRouteInCache,
});

export const routeUpdate = defineMutation({
    key: qm.routeUpdate,
    run: (api, vars: { id: string; data: Partial<VideoRoute> }) =>
        api.videoRoutes.update(vars.id, vars.data),
    patch: mergeRouteInCache,
});

export const routeDelete = defineMutation({
    key: qm.routeDelete,
    run: (api, vars: { id: string }) => api.videoRoutes.delete(vars.id),
    patch: (_result, vars) => removeRouteFromCache(vars.id),
});

export const routeSetEnabled = defineMutation({
    key: qm.routeSetEnabled,
    run: (api, vars: { id: string; enabled: boolean }) =>
        api.videoRoutes.setEnabled(vars.id, vars.enabled),
    patch: mergeRouteInCache,
});

/** Mounted once in QuerySync. The server excludes the originating client from
 *  these broadcasts, so they only ever describe another client's mutation —
 *  our own writes patch the cache directly in the mutation flow. */
export function useRoutesSync(): void {
    const conn = useSocket();

    useWsBroadcast(conn, 'routes', 'CREATE', data => {
        const route = data as VideoRoute;
        if (!route?.id) return;
        mergeRouteInCache(route);
    });

    useWsBroadcast(conn, 'routes', 'UPDATE', data => {
        const route = data as VideoRoute;
        if (!route?.id) return;
        replaceRouteInCache(route);
    });

    useWsBroadcast(conn, 'routes', 'DELETE', data => {
        if (typeof data !== 'string') return;
        removeRouteFromCache(data);
    });
}
