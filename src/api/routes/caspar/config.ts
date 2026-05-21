import {WebError} from 'rest-exchange-protocol';
import {configuration} from '../../../manager/config';
import {Config} from '../../../manager/caspar/config/types';

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
    'GET': async () => {
        // Force a re-read so the page reflects what's actually on disk,
        // not a stale snapshot from CasparCG startup. `_raw` is the parsed
        // XML and not useful to clients.
        const config = await configuration.get(true);
        const {_raw, ...rest} = config;
        return rest;
    },
    'UPDATE': async (request) => {
        const payload = request.getData();
        if (!validate(payload)) throw new WebError('Invalid config payload', 400);

        const updated = await configuration.set(payload);
        const {_raw, ...rest} = updated;
        return rest;
    },
};
