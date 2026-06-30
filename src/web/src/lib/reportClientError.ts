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

/** Fire-and-forget: sends a client error report to `/api/log/client`.
 *  No-ops silently if the socket is not yet connected. */
export const reportClientError = (report: ClientErrorReport) => {
    if (!client) return;
    client
        .rawRequest('/api/log/client', 'ACTION', {
            ...report,
            url:
                typeof window !== 'undefined'
                    ? window.location.href
                    : undefined,
        })
        .catch(() => {});
};
