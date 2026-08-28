import type React from 'react';
import { useEffect, useRef } from 'react';
import { queryClient } from '../lib/query/client';
import { useConnection } from './ConnectionProvider';

/** Renderless mount point for the per-domain cache sync hooks. Also refetches
 *  everything after a reconnect: broadcasts missed while the socket was down
 *  mean any cached data may be stale. Mirrors the reconnect transition
 *  UndoProvider uses for clearAll() so the two stay in lockstep. */
export const QuerySync: React.FC = () => {
    const { state } = useConnection();

    const wasConnectedRef = useRef(state === 'connected');
    useEffect(() => {
        const reconnected = state === 'connected' && !wasConnectedRef.current;
        wasConnectedRef.current = state === 'connected';
        if (reconnected) void queryClient.invalidateQueries();
    }, [state]);

    return null;
};
