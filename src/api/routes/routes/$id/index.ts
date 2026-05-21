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
    'UPDATE': async (request) => {
        if (!request.params.id) throw new WebError('No id', 400);

        const data = request.getData();
        if (typeof data !== 'object' || data === null)
            throw new WebError('Request body must be an object', 400);

        const manager = CasparManager.getManager();
        const existing = manager.routes.getVideoRoute(request.params.id);
        if (!existing) throw new WebError('Route not found', 404);

        // Merge incoming patch over the existing route. Force the id from the
        // URL to win over any id the body tries to set.
        await manager.routes.updateVideoRoute({
            ...existing,
            ...(data as Record<string, unknown>),
            id: existing.id,
        } as typeof existing);

        return manager.routes.getVideoRoute(existing.id);
    },
};
