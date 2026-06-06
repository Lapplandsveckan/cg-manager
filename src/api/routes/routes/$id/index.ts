import {WebError} from 'rest-exchange-protocol';
import {type RouteExport} from '../../../route';
import {CasparManager} from '../../../../manager';

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

        // Required fields fall back to the existing route (so legacy
        // partial patches still work). Optional fields (transform / edgeblend
        // / perspective / metadata) are deliberately NOT carried over — the
        // payload is the source of truth, and absence means "cleared". That's
        // the only way the geometry editor's "reset to identity" can actually
        // remove a previously-set transform from the saved route.
        const payload = data as Partial<typeof existing>;
        const next: typeof existing = {
            id: existing.id,
            name: payload.name ?? existing.name,
            source: payload.source ?? existing.source,
            destination: payload.destination ?? existing.destination,
            enabled: payload.enabled ?? existing.enabled,
            ...(payload.transform   ? {transform:   payload.transform}   : {}),
            ...(payload.edgeblend   ? {edgeblend:   payload.edgeblend}   : {}),
            ...(payload.perspective ? {perspective: payload.perspective} : {}),
            ...(payload.metadata    ? {metadata:    payload.metadata}    : {}),
        };

        await manager.routes.updateVideoRoute(next);
        return manager.routes.getVideoRoute(existing.id);
    },
} satisfies RouteExport;
