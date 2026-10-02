import { useQuery } from '@tanstack/react-query';
import {
    Method,
    defineMutation,
    queryClient,
    topic,
    useBroadcast,
    useSocket,
    type Rollback,
} from '@web-lib';
import { routesApi, type VideoRoute } from './api';

export const routeCreated = topic(
    'plugin/routes/routes',
    Method.CREATE,
    (data): data is VideoRoute => typeof (data as VideoRoute)?.id === 'string',
);

export const routeUpdated = topic(
    'plugin/routes/routes',
    Method.UPDATE,
    (data): data is VideoRoute => typeof (data as VideoRoute)?.id === 'string',
);

export const routeDeleted = topic(
    'plugin/routes/routes',
    Method.DELETE,
    (data): data is string => typeof data === 'string',
);

const routesKey = ['plugin', 'routes', 'list'] as const;
const routeKeys = () => [routesKey] as const;

export function useRoutesQuery() {
    const conn = useSocket();
    return useQuery({
        queryKey: routesKey,
        queryFn: () => routesApi.list(conn),
    });
}

function healIfUnfetched(): boolean {
    if (queryClient.getQueryData(routesKey) !== undefined) return false;
    void queryClient.invalidateQueries({ queryKey: routesKey });
    return true;
}

function cachedRoute(id: string): VideoRoute | undefined {
    return queryClient
        .getQueryData<VideoRoute[]>(routesKey)
        ?.find(r => r.id === id);
}

export function mergeRouteInCache(route: VideoRoute): Rollback | void {
    if (healIfUnfetched()) return undefined;

    const before = cachedRoute(route.id);
    queryClient.setQueryData<VideoRoute[]>(routesKey, prev => {
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

function replaceRouteInCache(route: VideoRoute): void {
    if (healIfUnfetched()) return;

    queryClient.setQueryData<VideoRoute[]>(routesKey, prev =>
        prev?.map(r => (r.id === route.id ? route : r)),
    );
}

export function removeRouteFromCache(id: string): Rollback | void {
    if (healIfUnfetched()) return undefined;

    const before = cachedRoute(id);
    queryClient.setQueryData<VideoRoute[]>(routesKey, prev =>
        prev?.filter(r => r.id !== id),
    );

    if (!before) return undefined;
    return () => mergeRouteInCache(before);
}

export const routeCreate = defineMutation({
    key: ['plugin', 'routes', 'create'],
    run: (api, vars: Omit<VideoRoute, 'id'>) => routesApi.create(api, vars),
    patch: mergeRouteInCache,
});

export const routeUpdate = defineMutation({
    key: ['plugin', 'routes', 'update'],
    keys: routeKeys,
    run: (api, vars: { id: string; data: Partial<VideoRoute> }) =>
        routesApi.update(api, vars.id, vars.data),
    optimistic: vars => {
        const current = cachedRoute(vars.id);
        if (current) return mergeRouteInCache({ ...current, ...vars.data });
    },
    patch: mergeRouteInCache,
});

export const routeDelete = defineMutation({
    key: ['plugin', 'routes', 'delete'],
    keys: routeKeys,
    run: (api, vars: { id: string }) => routesApi.delete(api, vars.id),
    optimistic: vars => removeRouteFromCache(vars.id),
});

export const routeSetEnabled = defineMutation({
    key: ['plugin', 'routes', 'setEnabled'],
    keys: routeKeys,
    run: (api, vars: { id: string; enabled: boolean }) =>
        routesApi.setEnabled(api, vars.id, vars.enabled),
    optimistic: vars => {
        const current = cachedRoute(vars.id);
        if (current)
            return mergeRouteInCache({ ...current, enabled: vars.enabled });
    },
    patch: mergeRouteInCache,
});

export function useRoutesSync(): void {
    useBroadcast(routeCreated, mergeRouteInCache);
    useBroadcast(routeUpdated, replaceRouteInCache);
    useBroadcast(routeDeleted, removeRouteFromCache);
}
