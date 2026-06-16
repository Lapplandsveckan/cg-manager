import { useEffect, useState } from 'react';
import { useSocket } from './useSocket';
import { useConnection } from '../../components/ConnectionProvider';
import type { CasparStatus } from '../api/caspar';

/** Returns true only when CasparCG is running and the manager is reachable. */
export function useCasparOnline(): boolean {
    const socket = useSocket();
    const { state: connectionState } = useConnection();
    const [running, setRunning] = useState<boolean>(false);

    useEffect(() => {
        if (!socket) return;
        const listener = (s: CasparStatus) => setRunning(s.running);
        socket.caspar.on('status', listener);
        socket.caspar
            .getStatus()
            .then(listener)
            .catch(() => setRunning(false));
        return () => {
            socket.caspar.off('status', listener);
        };
    }, [socket]);

    return running && connectionState !== 'disconnected';
}
