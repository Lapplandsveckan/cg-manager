import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { type ManagerApi } from '../api/api';
import { useSocket } from '../hooks/useSocket';
import { queryClient } from './client';

/** The exact undo of one `optimistic` call — e.g. `insertEntryInCache`
 *  returns `() => removeEntryFromCache(id, entry.id)`. Scoped to just the
 *  item that call touched (not a whole-key snapshot), so concurrent
 *  mutations on the same query key roll back independently instead of
 *  clobbering each other. */
export type Rollback = () => void;

/** One wire call + one cache patch, declared once and shared by the UI
 *  (`useMutationSpec`, real React mutation) and undo `apply` closures
 *  (`runMutation`, hookless — no cache-helper duplication between the
 *  forward and reverse path). `patch`/`optimistic` never record an undo
 *  entry — that stays the caller's job in both directions.
 *
 *  `optimistic` applies before the request, from `vars` alone, and
 *  *replaces* a vars-only `patch` rather than duplicating it — set one or
 *  the other, not both, unless the server result needs reconciling on top
 *  (e.g. `routeUpdate` merges `vars.data` optimistically, then `patch`
 *  overwrites with what the server actually stored). It returns a
 *  `Rollback` (or nothing, if there's nothing to undo — e.g. deleting an
 *  id that was never in the cache), which `onError` calls verbatim. `keys`
 *  lists the query keys `optimistic` touches, so they can be cancelled
 *  before the patch and re-synced after a rollback. */
export interface MutationSpec<V, R> {
    key: readonly unknown[];
    keys?: (vars: V) => readonly (readonly unknown[])[];
    run: (api: ManagerApi, vars: V) => Promise<R>;
    optimistic?: (vars: V) => Rollback | void;
    patch?: (result: R, vars: V) => void;
}

export const defineMutation = <V, R>(
    spec: MutationSpec<V, R>,
): MutationSpec<V, R> => spec;

function optionsFor<V, R>(spec: MutationSpec<V, R>, api: ManagerApi) {
    return {
        mutationKey: spec.key,
        mutationFn: (vars: V) => spec.run(api, vars),
        onMutate: async (vars: V) => {
            if (!spec.optimistic) return undefined;
            const keys = spec.keys?.(vars) ?? [];
            await Promise.all(
                keys.map(key => queryClient.cancelQueries({ queryKey: key })),
            );
            const result = spec.optimistic(vars);
            const rollback = typeof result === 'function' ? result : undefined;
            return { rollback, keys };
        },
        onError: (
            _err: Error,
            _vars: V,
            context:
                | { rollback?: Rollback; keys: readonly (readonly unknown[])[] }
                | undefined,
        ) => {
            context?.rollback?.();
            // Belt-and-suspenders: a broadcast from another client landing
            // mid-flight could make the rollback's own read stale too.
            for (const key of context?.keys ?? [])
                void queryClient.invalidateQueries({ queryKey: key });
        },
        onSuccess: (result: R, vars: V) => spec.patch?.(result, vars),
    };
}

export function useMutationSpec<V, R>(
    spec: MutationSpec<V, R>,
): UseMutationResult<R, Error, V> {
    const conn = useSocket();
    return useMutation(optionsFor(spec, conn));
}

/** Hookless — for undo `apply` closures, which receive `api` from the undo
 *  runtime rather than a hook. Runs through the same MutationCache as
 *  `useMutationSpec` (so `queryClient.isMutating` sees it) and applies the
 *  same `patch` on success. */
export function runMutation<V, R>(
    spec: MutationSpec<V, R>,
    api: ManagerApi,
    vars: V,
): Promise<R> {
    return queryClient
        .getMutationCache()
        .build(queryClient, optionsFor(spec, api))
        .execute(vars);
}
