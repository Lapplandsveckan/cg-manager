import {CasparManager} from '../../../../manager';
import {WebError} from 'rest-exchange-protocol';

export default {
    'ACTION': async (request) => {
        if (!request.params.id) throw new WebError('No id', 400);

        const manager = CasparManager.getManager();
        manager.routes.disableVideoRoute(request.params.id);

        const route = manager.routes.getVideoRoute(request.params.id);
        if (!route) throw new WebError('Route not found', 404);
        return route;
    },
};
