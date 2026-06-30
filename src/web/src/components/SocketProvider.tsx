import React, { useEffect, useState } from 'react';
import { ManagerApi } from '../lib/api/api';
import { setErrorReporter } from '../lib/reportClientError';

interface SocketContextValue {
    conn: ManagerApi | null;
}

export const SocketContext = React.createContext<SocketContextValue>({
    conn: null,
});

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [conn] = useState<ManagerApi | null>(() => {
        if (typeof window === 'undefined') return null;
        return new ManagerApi(window.location.host);
    });

    useEffect(() => {
        if (!conn) return;
        conn.connect();
        setErrorReporter(conn);
        return () => {
            conn.disconnect();
            setErrorReporter(null);
        };
    }, [conn]);

    return (
        <SocketContext.Provider value={{ conn }}>
            {children}
        </SocketContext.Provider>
    );
};
