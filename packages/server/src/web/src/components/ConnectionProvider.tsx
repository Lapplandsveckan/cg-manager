import React, { useContext } from 'react';
import { useSocket } from '../lib/hooks/useSocket';
import { useHeartbeat } from '../lib/hooks/useHeartbeat';
import type { ConnectionState } from '../lib/hooks/useHeartbeat';

export type { ConnectionState };

interface ConnectionContextValue {
    state: ConnectionState;
    lastSeen: number | null;
}

const ConnectionContext = React.createContext<ConnectionContextValue>({
    state: 'connected',
    lastSeen: null,
});

export const useConnection = () => useContext(ConnectionContext);

export const ConnectionProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const socket = useSocket();
    const connection = useHeartbeat(socket);

    return (
        <ConnectionContext.Provider value={connection}>
            {children}
        </ConnectionContext.Provider>
    );
};
