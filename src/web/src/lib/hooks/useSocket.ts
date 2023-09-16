import {SocketContext} from '../../components/SocketProvider';
import {useContext} from 'react';

export function useSocket() {
    const context = useContext(SocketContext);
    return context?.conn;
}