import { type RouteExport } from '../../route';
import { parseBody } from '../../validate';
import { CasparManager } from '../../../manager';
import { nameBody } from '../../../schemas/rundown';

export default {
    CREATE: async request => {
        const name = parseBody(nameBody, request);

        const manager = CasparManager.getManager();

        const rundown = manager.rundowns.createRundown(name, 'quick');

        manager.server.broadcast(
            'rundown',
            'CREATE',
            rundown,
            request.getClient(),
        );

        return rundown;
    },
    GET: async () => CasparManager.getManager().rundowns.getQuickActions(),
} satisfies RouteExport;
