import {WebError} from 'rest-exchange-protocol';
import {CasparManager} from '../../../../manager';

export default {
    'DELETE': async (request) => {
        if (!request.params.id) throw new WebError('Invalid request data', 400);

        const manager = CasparManager
            .getManager();

        await manager
            .rundowns
            .deleteRundown(request.params.id);

        manager
            .server
            .broadcast('rundown', 'DELETE', request.params.id, request.getClient());

        return null;
    },
    'UPDATE': async (request) => {
        if (!request.params.id) throw new WebError('Invalid request data', 400);

        const data = request.getData();
        if (typeof data !== 'string') throw new WebError('Invalid request data', 400);

        const manager = CasparManager
            .getManager();

        await manager
            .rundowns
            .updateRundown(request.params.id, data);

        manager
            .server
            .broadcast('rundown', 'UPDATE', { id: request.params.id, name: data }, request.getClient());

        return null;
    },
    'GET': async (request) => {
        if (!request.params.id) throw new WebError('Invalid request data', 400);

        return CasparManager
            .getManager()
            .rundowns
            .getRundown(request.params.id);
    },
};