import { QueryClient } from '@tanstack/react-query';

/** Module singleton (not created in _app render) so cache helpers, broadcast
 *  sync hooks, and undo apply closures can write to the cache without a React
 *  context — an undo apply can run long after its recording component
 *  unmounted. The cache is push-driven: broadcasts keep it fresh, so queries
 *  never go stale or auto-refetch on their own. Errors surfaced by queryFns
 *  are real server errors (the REP transport never rejects — queryFns
 *  assertOk the envelope), so retrying them would be wrong. networkMode
 *  'always' because the app is LAN-local and navigator.onLine is unreliable
 *  there. */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: Infinity,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            retry: false,
            networkMode: 'always',
        },
        mutations: {
            retry: false,
            networkMode: 'always',
        },
    },
});
