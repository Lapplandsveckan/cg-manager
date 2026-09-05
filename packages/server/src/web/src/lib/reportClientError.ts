import { noTry } from 'no-try';
import * as Sentry from '@sentry/react';
import { type ManagerApi } from './api/api';

let client: ManagerApi | null = null;

export const setErrorReporter = (c: ManagerApi | null) => {
    client = c;
};

export interface ClientErrorReport {
    source: string;
    message: string;
    stack?: string;
    componentStack?: string;
}

/** Path relative to the API root, shared with `ManagerApi.logClientError`'s
 *  socket-request path so the two transports can't drift apart. */
export const CLIENT_ERROR_PATH = 'api/log/client';

/** Fire-and-forget: sends a client error report to `/api/log/client`.
 *  Prefers `navigator.sendBeacon` — a plain same-origin HTTP POST that the
 *  browser queues independently of the page's JS/WS state, so a report can
 *  still land when the socket itself is what broke. Falls back to the
 *  socket client when sendBeacon isn't available, throws (e.g. the document
 *  isn't fully active), or declines to queue the payload. */
export const reportClientError = (report: ClientErrorReport) => {
    const payload = {
        ...report,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
    };

    // Sentry.captureException no-ops when telemetry isn't initialised — this
    // is the single sink for both _app.tsx's ErrorBoundarys and every
    // SlotErrorBoundary, so this one call covers all React crashes. Kept
    // alongside the beacon below (not instead of it): the beacon is the
    // fallback when no DSN is configured, and still reaches the server log.
    noTry(() =>
        Sentry.withScope(scope => {
            scope.setTag('origin', 'browser');
            scope.setTag('source', report.source);
            if (report.componentStack)
                scope.setExtra('componentStack', report.componentStack);
            const error = new Error(report.message);
            if (report.stack) error.stack = report.stack;
            Sentry.captureException(error);
        }),
    );

    const [, sentViaBeacon] = noTry(
        () =>
            typeof navigator !== 'undefined' &&
            typeof navigator.sendBeacon === 'function' &&
            navigator.sendBeacon(
                `/${CLIENT_ERROR_PATH}`,
                new Blob([JSON.stringify(payload)], {
                    type: 'application/json',
                }),
            ),
    );
    if (sentViaBeacon) return;

    if (!client) return;
    client.logClientError(payload).catch(() => {});
};
