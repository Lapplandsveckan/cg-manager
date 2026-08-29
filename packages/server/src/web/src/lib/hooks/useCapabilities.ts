import { type Capabilities, type CapabilitiesResponse } from '../api/caspar';
import { useCapabilitiesQuery } from '../query/caspar';

const DEFAULT: CapabilitiesResponse = {
    profile: 'upstream',
    capabilities: { artnet: 'legacy', edgeblend: false },
};

export function useCapabilities(): CapabilitiesResponse {
    const { data } = useCapabilitiesQuery();
    return data ?? DEFAULT;
}

export type { Capabilities };
