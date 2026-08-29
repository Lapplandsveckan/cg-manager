import { noTry } from 'no-try';
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
