import { type RouteExport } from '../../../route';
import { idParams, parseBody, parseParams } from '../../../validate';
import { CasparManager } from '../../../../manager';
import { nameBody } from '../../../../schemas/rundown';

export default {
    DELETE: async request => {
        const { id } = parseParams(idParams, request);

        const manager = CasparManager.getManager();

        await manager.rundowns.deleteRundown(id);

        manager.server.broadcast('rundown', 'DELETE', id, request.getClient());

        return null;
    },
    UPDATE: async request => {
        const { id } = parseParams(idParams, request);
        const name = parseBody(nameBody, request);

        const manager = CasparManager.getManager();

        await manager.rundowns.updateRundown(id, name);

        manager.server.broadcast(
            'rundown',
            'UPDATE',
            { id, name },
            request.getClient(),
        );

        return null;
    },
    GET: async request => {
        const { id } = parseParams(idParams, request);

        return CasparManager.getManager().rundowns.getRundown(id);
    },
} satisfies RouteExport;
