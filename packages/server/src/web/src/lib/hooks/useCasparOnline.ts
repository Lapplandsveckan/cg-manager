import { useConnection } from '../../components/ConnectionProvider';
import { useCasparStatusQuery } from '../query/caspar';

/** Returns true only when CasparCG is running and the manager is reachable. */
export function useCasparOnline(): boolean {
    const { state: connectionState } = useConnection();
    const { data: status } = useCasparStatusQuery();

    return (status?.running ?? false) && connectionState !== 'disconnected';
}
