import {WebError} from 'rest-exchange-protocol';
import {CasparManager} from '../../../../manager';

export default {
    'UPDATE': async (request) => {
        if (!request.params.id) throw new WebError('Invalid request data', 400);

        const data = request.getData();
        if (!data || typeof data !== 'object' || typeof data.enabled !== 'boolean') throw new WebError('Invalid request data', 400);

        const { enabled } = data;
        const manager = CasparManager
            .getManager();

        const route = manager
            .routes
            .getVideoRoute(request.params.id);

        manager
            .routes
            .setVideoRouteEnabled(request.params.id, enabled);

        manager
            .server
            .broadcast('route', 'UPDATE', { id: route.id, name: route.metadata?.name, enabled }, request.getClient());

        return null;
    },
};
