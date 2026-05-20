import {CasparManager} from '../../../../manager';
import {WebError} from 'rest-exchange-protocol';

export default {
    'GET': async (request) => {
        if (!request.params.id) throw new WebError('No id', 400);

        const route = CasparManager
            .getManager()
            .routes
            .getVideoRoute(request.params.id);

        if (!route) throw new WebError('Route not found', 404);
        return route;
    },
    'DELETE': async (request) => {
        if (!request.params.id) throw new WebError('No id', 400);

        await CasparManager
            .getManager()
            .routes
            .deleteVideoRoute(request.params.id);

        return { ok: true };
    },
};
