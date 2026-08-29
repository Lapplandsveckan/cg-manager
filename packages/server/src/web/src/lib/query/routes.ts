import { useQuery } from '@tanstack/react-query';
import { routeCreated, routeDeleted, routeUpdated } from '../api/broadcasts';
import type { VideoRoute } from '../api/videoRoutes';
import { useBroadcast } from '../hooks/useBroadcast';
import { useSocket } from '../hooks/useSocket';
import { queryClient } from './client';
import { qk, qm } from './keys';
import { defineMutation, type Rollback } from './mutations';

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

/** Upsert; returns the `Rollback` to whatever was there before (a prior
 *  version of the route, or removal entirely if this was an insert) — same
 *  reasoning as `insertEntryInCache` et al. */
export function mergeRouteInCache(route: VideoRoute): Rollback | void {
    if (healIfUnfetched()) return undefined;
    const before = cachedRoute(route.id);
    queryClient.setQueryData<VideoRoute[]>(qk.routes, prev => {
        if (!prev) return prev;
        const exists = prev.some(r => r.id === route.id);
        return exists
            ? prev.map(r => (r.id === route.id ? route : r))
            : [...prev, route];
    });
    return before
        ? () => mergeRouteInCache(before)
        : () => removeRouteFromCache(route.id);
}

/** Replace-only, for UPDATE broadcasts: after we delete a route locally, a
 *  late UPDATE broadcast for it must not resurrect it in the cache. */
function replaceRouteInCache(route: VideoRoute): void {
    if (healIfUnfetched()) return;
    queryClient.setQueryData<VideoRoute[]>(qk.routes, prev =>
        prev?.map(r => (r.id === route.id ? route : r)),
    );
}

export function removeRouteFromCache(id: string): Rollback | void {
    if (healIfUnfetched()) return undefined;
    const before = cachedRoute(id);
    queryClient.setQueryData<VideoRoute[]>(qk.routes, prev =>
        prev?.filter(r => r.id !== id),
    );
    if (!before) return undefined;
    return () => mergeRouteInCache(before);
}

const routeKeys = () => [qk.routes] as const;

function cachedRoute(id: string): VideoRoute | undefined {
    return queryClient
        .getQueryData<VideoRoute[]>(qk.routes)
        ?.find(r => r.id === id);
}

/** See `MutationSpec` for why these exist. `routeCreate` is skipped —
 *  the id is server-assigned, so an optimistic entry would need a
 *  temp-id → real-id remap on the happy path for no real win. */
export const routeCreate = defineMutation({
    key: qm.routeCreate,
    run: (api, vars: Omit<VideoRoute, 'id'>) => api.videoRoutes.create(vars),
    patch: mergeRouteInCache,
});

/** Optimistic merge of `vars.data`; `patch` then reconciles with whatever
 *  the server actually stored (e.g. defaults it filled in). */
export const routeUpdate = defineMutation({
    key: qm.routeUpdate,
    keys: routeKeys,
    run: (api, vars: { id: string; data: Partial<VideoRoute> }) =>
        api.videoRoutes.update(vars.id, vars.data),
    optimistic: vars => {
        const current = cachedRoute(vars.id);
        if (current) return mergeRouteInCache({ ...current, ...vars.data });
    },
    patch: mergeRouteInCache,
});

export const routeDelete = defineMutation({
    key: qm.routeDelete,
    keys: routeKeys,
    run: (api, vars: { id: string }) => api.videoRoutes.delete(vars.id),
    optimistic: vars => removeRouteFromCache(vars.id),
});

export const routeSetEnabled = defineMutation({
    key: qm.routeSetEnabled,
    keys: routeKeys,
    run: (api, vars: { id: string; enabled: boolean }) =>
        api.videoRoutes.setEnabled(vars.id, vars.enabled),
    optimistic: vars => {
        const current = cachedRoute(vars.id);
        if (current)
            return mergeRouteInCache({ ...current, enabled: vars.enabled });
    },
    patch: mergeRouteInCache,
});

/** Mounted once in QuerySync. The server excludes the originating client from
 *  these broadcasts, so they only ever describe another client's mutation —
 *  our own writes patch the cache directly in the mutation flow. */
export function useRoutesSync(): void {
    useBroadcast(routeCreated, mergeRouteInCache);
    useBroadcast(routeUpdated, replaceRouteInCache);
    useBroadcast(routeDeleted, removeRouteFromCache);
}
