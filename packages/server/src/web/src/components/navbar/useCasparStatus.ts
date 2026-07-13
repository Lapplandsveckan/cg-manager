import { useEffect, useState } from 'react';
import { type CasparStatus } from '../../lib/api/caspar';
import { useConnection } from '../ConnectionProvider';
import { useSocket } from '../../lib/hooks/useSocket';

export type StatusKey = 'unreachable' | 'running' | 'stopped' | 'unknown';

export interface StatusInfo {
    color: string;
    key: StatusKey;
    glow: boolean;
}

export function useCasparStatus(): StatusInfo {
    const socket = useSocket();
    const { state: connectionState } = useConnection();
    const [running, setRunning] = useState<boolean | null>(null);

    useEffect(() => {
        if (!socket) return;
        const listener = (status: CasparStatus) => setRunning(status.running);
        socket.caspar.on('status', listener);
        socket.caspar
            .getStatus()
            .then(listener)
            .catch(() => setRunning(null));
        return () => {
            socket.caspar.off('status', listener);
        };
    }, [socket]);

    // The websocket retains its last broadcast; once we know the manager is
    // unreachable, the cached running flag is stale and would otherwise keep
    // showing a green/red dot from before the outage. Surface as "Unreachable"
    // until heartbeats recover.
    if (connectionState === 'disconnected')
        return {
            color: 'rgba(232, 234, 237, 0.3)',
            key: 'unreachable',
            glow: false,
        };

    if (running === true)
        return { color: '#5fc97a', key: 'running', glow: true };
    if (running === false)
        return { color: '#cf5b4a', key: 'stopped', glow: false };
    return { color: 'rgba(232, 234, 237, 0.3)', key: 'unknown', glow: false };
}
