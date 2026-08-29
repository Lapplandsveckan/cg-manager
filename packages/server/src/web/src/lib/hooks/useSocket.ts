import { useContext } from 'react';
import { SocketContext } from '../../components/SocketProvider';
import { type ManagerApi } from '../api/api';

export class NoSocketError extends Error {
    constructor() {
        super('useSocket: no socket connection available');
    }
}

export function useSocket(): ManagerApi {
    const conn = useContext(SocketContext).conn;
    if (!conn) throw new NoSocketError();

    return conn;
}
