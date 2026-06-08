import { WebError } from 'rest-exchange-protocol';
import { type RouteExport } from '../../route';
import { configuration } from '../../../manager/config';
import { type Config } from '../../../manager/caspar/config/types';

function validate(data: any): data is Config {
    if (!data || typeof data !== 'object') return false;
    if (typeof data.version !== 'string') return false;
    if (!Array.isArray(data.videoModes)) return false;
    if (!Array.isArray(data.channels)) return false;
    for (const ch of data.channels) {
        if (!ch || typeof ch.videoMode !== 'string') return false;
        if (!Array.isArray(ch.consumers)) return false;
    }
    return true;
}

export default {
    // Force a re-read so the page reflects what's actually on disk, not a
    // stale snapshot from CasparCG startup.
    GET: async () => configuration.get(true),
    UPDATE: async request => {
        const payload = request.getData();
        if (!validate(payload))
            throw new WebError('Invalid config payload', 400);

        return configuration.set(payload);
    },
} satisfies RouteExport;
