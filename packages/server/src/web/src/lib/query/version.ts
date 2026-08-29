import { useQuery } from '@tanstack/react-query';
import { useSocket } from '../hooks/useSocket';
import { qk } from './keys';

export function useVersionQuery() {
    const conn = useSocket();
    return useQuery({
        queryKey: qk.version,
        queryFn: () => conn.getApiVersion(),
    });
}
