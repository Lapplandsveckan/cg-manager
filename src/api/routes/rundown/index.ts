import { WebError } from 'rest-exchange-protocol';
import { type RouteExport } from '../../route';
import { CasparManager } from '../../../manager';

export default {
    CREATE: async request => {
        const data = request.getData();
        if (typeof data !== 'string')
            throw new WebError('Invalid request data', 400);

        const manager = CasparManager.getManager();

        const rundown = manager.rundowns.createRundown(data);

        manager.server.broadcast(
            'rundown',
            'CREATE',
            rundown,
            request.getClient(),
        );

        return rundown;
    },
    GET: async () => CasparManager.getManager().rundowns.getRundowns(),
} satisfies RouteExport;
