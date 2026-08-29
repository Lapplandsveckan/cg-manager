import { useQuery } from '@tanstack/react-query';
import { type ManagerApi } from '../api/api';
import { useSocket } from '../hooks/useSocket';
import { qk } from './keys';

async function fetchVersion(conn: ManagerApi): Promise<string> {
    const res = await conn.rawRequest('/api/version', 'GET', {});
    return res.data as string;
}

export function useVersionQuery() {
    const conn = useSocket();
    return useQuery({
        queryKey: qk.version,
        enabled: !!conn,
        queryFn: () => fetchVersion(conn as ManagerApi),
    });
}
