import { useEffect, useRef } from 'react';
import type { ConnectionState } from '../hooks/useHeartbeat';
import { clearAll } from './undoStore';

/** Drops the undo/redo stacks on reconnect — stale entries would replay
 *  against server state that no longer matches what they captured. */
export function useUndoReconnectClear(connectionState: ConnectionState): void {
    const wasConnectedRef = useRef(connectionState === 'connected');

    useEffect(() => {
        const reconnected =
            connectionState === 'connected' && !wasConnectedRef.current;
        wasConnectedRef.current = connectionState === 'connected';
        if (reconnected) clearAll();
    }, [connectionState]);
}
