import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type Injection, type UI_INJECTION_ZONE_KEY } from '../api/inject';
import { useSocket } from '../hooks/useSocket';
import { qk } from './keys';

export function usePluginInjectionsQuery() {
    const conn = useSocket();
    return useQuery({
        queryKey: qk.pluginInjections,
        queryFn: () => conn.injects.list(),
    });
}

export function injectionsForZone(
    injections: Injection[],
    zone: UI_INJECTION_ZONE_KEY,
    plugin: string | null = null,
): Injection[] {
    return injections.filter(
        i => i.zone === zone && (!plugin || i.plugin === plugin),
    );
}

/** Injections whose zone exactly equals baseZone OR starts with
 *  `${baseZone}.` (the per-tab dotted-subzone convention). */
export function injectionsByZone(
    injections: Injection[],
    baseZone: UI_INJECTION_ZONE_KEY,
): Injection[] {
    const prefix = `${baseZone}.`;
    return injections.filter(
        i => i.zone === baseZone || i.zone.startsWith(prefix),
    );
}

export function useInjectionsForZone(
    zone: UI_INJECTION_ZONE_KEY,
    plugin: string | null = null,
) {
    const { data } = usePluginInjectionsQuery();
    return useMemo(
        () => (data ? injectionsForZone(data, zone, plugin) : []),
        [data, zone, plugin],
    );
}

export function useInjectionsByZone(baseZone: UI_INJECTION_ZONE_KEY) {
    const { data } = usePluginInjectionsQuery();
    return useMemo(
        () => (data ? injectionsByZone(data, baseZone) : []),
        [data, baseZone],
    );
}

/** Resolves a list of injections into their loaded components. Not backed by
 *  the query cache — resolved modules are non-serializable ES module
 *  namespaces owned by `PluginInjectionAPI`'s own memoizing `_modules` map
 *  (see lib/api/inject.ts), so this just tracks the async resolution as
 *  local state, keyed on the injection id set. `manifestPending` folds in
 *  the injection-manifest query's own loading state, so `loaded` doesn't go
 *  true for a split second before the manifest (and therefore `injections`)
 *  is even known — which would otherwise flash a caller's empty-state
 *  fallback on every first render. */
export function useInjectedComponents(
    injections: Injection[],
    manifestPending: boolean,
) {
    const [components, setComponents] = useState<
        { id: string; component: ComponentType }[]
    >([]);
    const [resolved, setResolved] = useState(false);
    const conn = useSocket();
    const ids = injections.map(i => i.id).join(',');

    useEffect(() => {
        let mounted = true;
        setResolved(false);
        setComponents([]);

        Promise.all(
            injections.map(i =>
                conn.injects
                    .import(i.id)
                    .then(component => ({ id: i.id, component }))
                    .catch(() => null),
            ),
        ).then(results => {
            if (!mounted) return;
            setComponents(results.filter(r => r !== null));
            setResolved(true);
        });

        return () => {
            mounted = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conn, ids]);

    return { components, loaded: resolved && !manifestPending };
}
