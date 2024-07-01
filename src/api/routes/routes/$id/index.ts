import {WebError} from 'rest-exchange-protocol';
import {CasparManager} from '../../../../manager';

export default {
    'GET': async (request) => {
        if (!request.params.id) throw new WebError('Invalid request data', 400);

        const manager = CasparManager
            .getManager();

        const route =  manager
            .routes
            .getVideoRoute(request.params.id);

        if (!route) throw new WebError('Route not found', 404);
        return {
            id: route.id,
            name: route.metadata?.name,

            enabled: manager.routes.getVideoRouteEnabled(route.id),
        };
    },
    'UPDATE': async (request) => {
        if (!request.params.id) throw new WebError('Invalid request data', 400);

        const manager = CasparManager
            .getManager();

        const route = manager
            .routes
            .getVideoRoute(request.params.id);

        if (!route) throw new WebError('Route not found', 404);

        await manager.routes.updateVideoRoute({
            ...route,
            ...request.data,
        });

        return {
            id: route.id,
            name: route.metadata?.name,

            enabled: manager.routes.getVideoRouteEnabled(route.id),
        };
    }
};
