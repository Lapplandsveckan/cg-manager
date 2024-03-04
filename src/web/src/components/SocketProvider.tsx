import React, { useEffect, useState } from 'react';
import {ManagerApi} from '../lib/api/api';

let conn: ManagerApi | null = null;
if (typeof window !== 'undefined') {
    conn = new ManagerApi(window.location.host);
    conn.connect();
}

export const SocketContext = React.createContext<{
    conn: ManagerApi | null;
}>({
    conn: null,
});

export const SocketProvider: React.FC<{children: React.ReactNode}> = ({
    children,
}) => {
    return (
        <SocketContext.Provider
            value={{
                conn,
            }}
        >
            {children}
        </SocketContext.Provider>
    );
};