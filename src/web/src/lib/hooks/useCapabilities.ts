import { useEffect, useState } from 'react';
import { useSocket } from './useSocket';
import { type Capabilities, type CapabilitiesResponse } from '../api/caspar';

const DEFAULT: CapabilitiesResponse = {
    profile: 'upstream',
    capabilities: { artnet: 'legacy', edgeblend: false },
};

export function useCapabilities(): CapabilitiesResponse {
    const [data, setData] = useState<CapabilitiesResponse>(DEFAULT);
    const conn = useSocket();

    useEffect(() => {
        if (!conn) return;
        conn.caspar
            .getCapabilities()
            .then(setData)
            .catch(() => {});
    }, [conn]);

    return data;
}

export type { Capabilities };
