import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { type ManagerApi } from '../api/api';
import { useSocket } from '../hooks/useSocket';
import { queryClient } from './client';

export type Rollback = () => void;

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
            // A broadcast mid-flight can leave the rollback read stale
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
