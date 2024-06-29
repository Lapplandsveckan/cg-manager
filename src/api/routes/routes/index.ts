import {CasparManager} from '../../../manager';

export default {
    'GET': async (request) => {
        const manager = CasparManager
            .getManager();

        return manager
            .routes
            .getVideoRoutes()
            .map(route => (
                { id: route.id, name: route.metadata?.name, enabled: manager.routes.getVideoRouteEnabled(route.id) }
            ));
    },
};
