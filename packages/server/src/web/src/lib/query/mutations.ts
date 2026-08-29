import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { type ManagerApi } from '../api/api';
import { useSocket } from '../hooks/useSocket';
import { queryClient } from './client';

/** One wire call + one cache patch, declared once and shared by the UI
 *  (`useMutationSpec`, real React mutation) and undo `apply` closures
 *  (`runMutation`, hookless — no cache-helper duplication between the
 *  forward and reverse path). `patch` never records an undo entry — that
 *  stays the caller's job in both directions. */
export interface MutationSpec<V, R> {
    key: readonly unknown[];
    run: (api: ManagerApi, vars: V) => Promise<R>;
    patch?: (result: R, vars: V) => void;
}

export const defineMutation = <V, R>(
    spec: MutationSpec<V, R>,
): MutationSpec<V, R> => spec;

function optionsFor<V, R>(spec: MutationSpec<V, R>, api: ManagerApi) {
    return {
        mutationKey: spec.key,
        mutationFn: (vars: V) => spec.run(api, vars),
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
