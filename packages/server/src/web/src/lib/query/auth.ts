import { useMutation, useQuery } from '@tanstack/react-query';
import { checkAuth, submitLogin, type AuthStatus } from '../auth';
import { queryClient } from './client';
import { qk, qm } from './keys';

export function useAuthQuery() {
    return useQuery({
        queryKey: qk.auth,
        queryFn: checkAuth,
    });
}

export const setAuthStatusInCache = (status: AuthStatus | null) =>
    queryClient.setQueryData(qk.auth, status);

/** Bypasses the query cache — used where a stale "still authenticated"
 *  read would be wrong, e.g. re-checking after a manager restart. Writes
 *  the fresh result through so `useAuthQuery` consumers pick it up too.
 *  A `null` result means "couldn't reach the server", not "logged out" —
 *  don't overwrite a known-good cached status with it, or a transient
 *  network blip (exactly when this is called, from a failing heartbeat
 *  tick) would strand `AuthGate` on its loading spinner forever. */
export async function refreshAuthStatus(): Promise<AuthStatus | null> {
    const status = await checkAuth();
    if (status) setAuthStatusInCache(status);
    return status;
}

export function useLoginMutation() {
    return useMutation({
        mutationKey: qm.login,
        mutationFn: submitLogin,
        onSuccess: ok => {
            if (ok)
                setAuthStatusInCache({ enabled: true, authenticated: true });
        },
    });
}
