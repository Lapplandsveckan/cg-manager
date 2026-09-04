/** Pattern-matches the CasparResponseError shape from @lappis/cg-manager
 *  without importing it directly (it's not exported from the public surface).
 *  AMCP timeouts come through with code -1 + name "CasparResponseError";
 *  protocol errors carry the AMCP 4xx/5xx code. */
export function isAmcpError(e: unknown): boolean {
    if (!e || typeof e !== 'object') return false;
    const err = e as { name?: string; code?: number };
    if (err.name === 'CasparResponseError') return true;
    return (
        typeof err.code === 'number' &&
        (err.code === -1 || (err.code >= 400 && err.code < 600))
    );
}

/** Formats a caught value for logging. CasparResponseError gets a compact
 *  one-liner instead of a multiline message + full stack. */
export function formatError(e: unknown): string | Error {
    if (isAmcpError(e) && typeof e === 'object' && e !== null) {
        const err = e as { name?: string; code?: number; data?: string[] };
        const msg = Array.isArray(err.data) ? err.data.join(', ') : '';
        return `${err.name ?? 'CasparResponseError'} (${err.code ?? '?'}): ${msg}`;
    }
    if (e instanceof Error) return e;
    if (typeof e === 'object') return JSON.stringify(e);
    return String(e);
}
