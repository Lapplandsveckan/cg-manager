import { useEffect } from 'react';
import { type ManagerApi } from '../api/api';
import { useLatest } from '../hooks/useLatest';

/** Subscribe to a server broadcast topic while mounted. The handler is read
 *  through a ref so callers can pass inline closures without re-registering
 *  on every render. */
export function useWsBroadcast(
    conn: ManagerApi | null | undefined,
    path: string,
    method: string,
    handler: (data: unknown) => void,
): void {
    const handlerRef = useLatest(handler);

    useEffect(() => {
        if (!conn) return;

        const listener = {
            path,
            method,
            handler: (request: { getData: () => unknown }) =>
                handlerRef.current(request.getData()),
        };
        conn.routes.register(listener);
        return () => conn.routes.unregister(listener);
    }, [conn, path, method, handlerRef]);
}
