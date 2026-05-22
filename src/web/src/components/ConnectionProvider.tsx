import React, {useContext, useEffect, useRef, useState} from 'react';
import {useSocket} from '../lib/hooks/useSocket';

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

export const ConnectionProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
    const socket = useSocket();
    const [state, setState] = useState<ConnectionState>('connected');
    const [lastSeen, setLastSeen] = useState<number | null>(null);
    const failsRef = useRef(0);

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
                const t = setTimeout(() => reject(new Error('timeout')), HEARTBEAT_TIMEOUT_MS);
                if (cancelled) clearTimeout(t);
            });
            try {
                await Promise.race([socket.getApiVersion(), timeoutPromise]);
                return true;
            } catch {
                return false;
            }
        };

        const tick = async () => {
            if (cancelled) return;
            const ok = await ping();
            if (cancelled) return;

            if (ok) {
                failsRef.current = 0;
                setLastSeen(Date.now());
                setState((prev) => (prev === 'connected' ? prev : 'connected'));
                timer = setTimeout(tick, HEARTBEAT_INTERVAL_OK_MS);
            } else {
                failsRef.current += 1;
                if (failsRef.current >= DISCONNECTED_THRESHOLD) 
                    setState('disconnected');
                else if (failsRef.current >= RECONNECTING_THRESHOLD) 
                    setState('reconnecting');
                
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
        <ConnectionContext.Provider value={{state, lastSeen}}>
            {children}
        </ConnectionContext.Provider>
    );
};
