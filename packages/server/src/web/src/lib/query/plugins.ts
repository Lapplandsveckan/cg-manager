import { useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { type Plugin } from '../api/plugin';
import { useSocket } from '../hooks/useSocket';
import { queryClient } from './client';
import { qk, qm } from './keys';
import { useWsBroadcast } from './useWsBroadcast';

export function usePluginsQuery() {
    const conn = useSocket();
    return useQuery({
        queryKey: qk.plugins,
        queryFn: () => conn.plugin.getPlugins(),
    });
}

/** `undefined` while the list (or `name` itself) isn't known yet, `null` once
 *  the list has loaded but `name` isn't in it. */
export function usePluginQuery(
    name: string | undefined,
): Plugin | null | undefined {
    const { data } = usePluginsQuery();
    return useMemo(() => {
        if (!name || !data) return undefined;
        return data.find(p => p.name === name) ?? null;
    }, [data, name]);
}

/** The `plugins` broadcast carries the complete list to every client
 *  (originator included), so setting an unfetched key is safe. */
function setPluginsInCache(list: Plugin[]): void {
    queryClient.setQueryData(qk.plugins, list);
}

/** Raw wire mutations; no cache patch on any of them — the `plugins`
 *  broadcast reconciles the cache for every client, originator included, so
 *  an optimistic patch here would just be redundant with the echo. */
export function usePluginMutations() {
    const conn = useSocket();

    const setEnabled = useMutation({
        mutationKey: qm.pluginSetEnabled,
        mutationFn: (vars: { name: string; enabled: boolean }) =>
            conn.plugin.setEnabled(vars.name, vars.enabled),
    });

    const uninstall = useMutation({
        mutationKey: qm.pluginUninstall,
        mutationFn: (name: string) => conn.plugin.uninstall(name),
    });

    const setActiveVersion = useMutation({
        mutationKey: qm.pluginSetVersion,
        mutationFn: (vars: { name: string; version: string }) =>
            conn.plugin.setActiveVersion(vars.name, vars.version),
    });

    const deleteVersion = useMutation({
        mutationKey: qm.pluginDeleteVersion,
        mutationFn: (vars: { name: string; version: string }) =>
            conn.plugin.deleteVersion(vars.name, vars.version),
    });

    return { setEnabled, uninstall, setActiveVersion, deleteVersion };
}

/** Mounted once in QuerySync. `plugins` goes to ALL clients (originator
 *  included) — replaces both the `PluginApi` EventEmitter and the
 *  `api.ts` `plugin.on('change') -> injects.refresh()` bridge. This topic is
 *  only reachable because `PluginApi` no longer registers a raw REP route
 *  for it — REP dispatches to the first match, so don't reintroduce one. */
export function usePluginsSync(): void {
    const conn = useSocket();

    useWsBroadcast(conn, 'plugins', 'ACTION', data => {
        if (!Array.isArray(data)) return;
        setPluginsInCache(data as Plugin[]);
        void queryClient.invalidateQueries({ queryKey: qk.pluginInjections });
    });
}
