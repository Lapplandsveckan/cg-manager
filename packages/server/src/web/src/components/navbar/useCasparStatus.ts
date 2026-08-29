import { useConnection } from '../ConnectionProvider';
import { useCasparStatusQuery } from '../../lib/query/caspar';

export type StatusKey = 'unreachable' | 'running' | 'stopped' | 'unknown';

export interface StatusInfo {
    color: string;
    key: StatusKey;
    glow: boolean;
}

export function useCasparStatus(): StatusInfo {
    const { state: connectionState } = useConnection();
    const { data: status } = useCasparStatusQuery();
    const running = status?.running ?? null;

    // The websocket retains its last broadcast; once we know the manager is
    // unreachable, the cached running flag is stale and would otherwise keep
    // showing a green/red dot from before the outage. Surface as "Unreachable"
    // until heartbeats recover.
    if (connectionState === 'disconnected')
        return {
            color: 'rgba(232, 234, 237, 0.3)',
            key: 'unreachable',
            glow: false,
        };

    if (running === true)
        return { color: '#5fc97a', key: 'running', glow: true };
    if (running === false)
        return { color: '#cf5b4a', key: 'stopped', glow: false };
    return { color: 'rgba(232, 234, 237, 0.3)', key: 'unknown', glow: false };
}
