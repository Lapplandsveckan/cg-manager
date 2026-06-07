import { useContext } from 'react';
import { SocketContext } from '../../components/SocketProvider';

export function useSocket() {
    const context = useContext(SocketContext);
    return context?.conn;
}
