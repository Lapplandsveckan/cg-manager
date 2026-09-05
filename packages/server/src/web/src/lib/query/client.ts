import { QueryCache, QueryClient } from '@tanstack/react-query';
import * as Sentry from '@sentry/react';
import { noTry } from 'no-try';
import { WebError } from '../api/api';

// 401 is the normal pre-login state; 404/409 are documented flow control
// (CLAUDE.md — e.g. the folder-not-empty delete check). A socket drop
// rejects every in-flight query at once with `new WebError('Disconnected')`
// (status 500 — the same status a genuine server-side route failure would
// carry, so this has to be matched by message, not status) — a LAN blip
// would otherwise burst one captureException per pending query. None of
// these are a bug in this app.
const ROUTINE_STATUSES = new Set([401, 404, 409]);
const isRoutineWebError = (error: unknown): boolean =>
    error instanceof WebError &&
    (ROUTINE_STATUSES.has(error.status) || error.message === 'Disconnected');

export const queryClient = new QueryClient({
    queryCache: new QueryCache({
        onError: error => {
            if (isRoutineWebError(error)) return;
            noTry(() => Sentry.captureException(error));
        },
    }),
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
