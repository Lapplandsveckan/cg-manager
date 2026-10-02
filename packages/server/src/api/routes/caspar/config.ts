import { type RouteExport } from '../../route';
import { parseBody } from '../../validate';
import { configuration } from '../../../manager/config';
import { type Config } from '../../../manager/caspar/config/types';
import { CasparManager } from '../../../manager';
import { casparConfigBody } from '../../../schemas/caspar';

export default {
    // Force a re-read so the page reflects what's actually on disk, not a
    // stale snapshot from CasparCG startup.
    GET: async () => configuration.get(true),
    UPDATE: async request => {
        const payload = parseBody(
            casparConfigBody,
            request,
        ) as unknown as Config;

        const saved = await configuration.set(payload);
        const manager = CasparManager.getManager();
        manager.getPlugins().updateChannelCount(saved.channels.length);

        // Other clients viewing the config page re-baseline live; the
        // originator already holds `saved` from this reply.
        manager.server.broadcast(
            'caspar/config',
            'UPDATE',
            saved,
            request.getClient(),
        );
        return saved;
    },
} satisfies RouteExport;
