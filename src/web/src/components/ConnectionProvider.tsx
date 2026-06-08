import React, { useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { noTryAsync } from 'no-try';
import { useSocket } from '../lib/hooks/useSocket';
import { checkAuth } from '../lib/auth';

export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected';

interface ConnectionContextValue {
    state: ConnectionState;
    lastSeen: number | null;
}

const ConnectionContext = React.createContext<ConnectionContextValue>({
    state: 'connected',
    lastSeen: null,
});

export const useConnection = () => useContext(ConnectionContext);

// Heartbeat tuning. While the socket looks healthy we poll lazily so we add
// minimal background traffic; once a heartbeat fails we retry faster so the
// banner appears quickly.
const HEARTBEAT_INTERVAL_OK_MS = 5000;
const HEARTBEAT_INTERVAL_RETRY_MS = 1500;
const HEARTBEAT_TIMEOUT_MS = 3000;

// One failure transitions to 'reconnecting' (subtle banner). Three consecutive
// failures escalate to 'disconnected' (loud banner) — short blips don't
// trigger the loud state.
const RECONNECTING_THRESHOLD = 1;
const DISCONNECTED_THRESHOLD = 3;

async function checkAuthExpired(): Promise<boolean> {
    const status = await checkAuth();
    return !!status && status.enabled && !status.authenticated;
}

export const ConnectionProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const socket = useSocket();
    const router = useRouter();
    const [state, setState] = useState<ConnectionState>('connected');
    const [lastSeen, setLastSeen] = useState<number | null>(null);
    const failsRef = useRef(0);
    // Guards against stacking overlapping /api/auth/check requests while we
    // re-poll for an expired session during a disconnect.
    const authCheckRef = useRef(false);
    // The heartbeat effect only depends on `socket` (a stable singleton), so it
    // runs once and would otherwise capture the router from that first render.
    // Next gives us a fresh router instance with frozen `asPath`/`isReady` on
    // every navigation, so keep the latest in a ref and read it at tick time —
    // otherwise the post-login bounce-back URL would be stale.
    const routerRef = useRef(router);
    routerRef.current = router;

    useEffect(() => {
        if (!socket) return;
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | null = null;

        const ping = async (): Promise<boolean> => {
            // The REP client's request promise will sit forever if the
            // websocket is dead, so race it against a timeout. A failed
            // request still leaves an entry in REPClient's internal requests
            // map — that's a small bounded leak we accept for the heartbeat.
            const timeoutPromise = new Promise<never>((_, reject) => {
                const t = setTimeout(
                    () => reject(new Error('timeout')),
                    HEARTBEAT_TIMEOUT_MS,
                );
                if (cancelled) clearTimeout(t);
            });
            const [err] = await noTryAsync(() =>
                Promise.race([socket.getApiVersion(), timeoutPromise]),
            );
            return !err;
        };

        const tick = async () => {
            if (cancelled) return;
            const ok = await ping();
            if (cancelled) return;

            if (ok) {
                failsRef.current = 0;
                setLastSeen(Date.now());
                setState(prev => (prev === 'connected' ? prev : 'connected'));
                timer = setTimeout(tick, HEARTBEAT_INTERVAL_OK_MS);
            } else {
                failsRef.current += 1;
                if (failsRef.current >= DISCONNECTED_THRESHOLD)
                    setState('disconnected');
                else if (failsRef.current >= RECONNECTING_THRESHOLD)
                    setState('reconnecting');

                // If the server is reachable but our session was wiped (e.g.
                // manager restart), redirect to login instead of looping forever.
                // Re-poll on every failing tick (not just the first): a restart
                // that outlasts the first failure means the initial check ran
                // while the server was unreachable and returned inconclusive, so
                // we have to keep asking until the server answers.
                if (
                    failsRef.current >= RECONNECTING_THRESHOLD &&
                    routerRef.current.isReady &&
                    !authCheckRef.current
                ) {
                    // Wait for router.isReady so router.asPath is the resolved
                    // URL and not a dynamic route pattern (e.g. /play/[id]),
                    // which would break the post-login bounce-back.
                    authCheckRef.current = true;
                    checkAuthExpired().then(expired => {
                        authCheckRef.current = false;
                        const router = routerRef.current;
                        if (expired && !cancelled)
                            router.replace(
                                `/login?from=${encodeURIComponent(router.asPath)}`,
                            );
                    });
                }

                timer = setTimeout(tick, HEARTBEAT_INTERVAL_RETRY_MS);
            }
        };

        tick();

        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
        };
    }, [socket]);

    return (
        <ConnectionContext.Provider value={{ state, lastSeen }}>
            {children}
        </ConnectionContext.Provider>
    );
};
