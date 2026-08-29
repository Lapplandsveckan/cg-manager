import { useQuery } from '@tanstack/react-query';
import { type ManagerApi } from '../api/api';
import { useSocket } from '../hooks/useSocket';
import { qk } from './keys';

export function useVersionQuery() {
    const conn = useSocket();
    return useQuery({
        queryKey: qk.version,
        enabled: !!conn,
        queryFn: () => (conn as ManagerApi).getApiVersion(),
    });
}
