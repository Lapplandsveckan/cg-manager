import { type PluginAPI } from '@lappis/cg-manager';
import { WebError, type Route } from 'rest-exchange-protocol';
import { parseBody } from '../../../api/validate';
import { shareCreateBody } from '../../../schemas/ingest';
import { type ScreenshareManager } from './manager';
import { destinationBody } from './schemas';

export function registerScreenshareEndpoints(
    api: PluginAPI,
    manager: ScreenshareManager,
): Route[] {
    return [
        api.registerRoute('sessions', () => api.ingest.listSessions(), 'GET'),
        api.registerRoute('shown', () => manager.shownIds(), 'GET'),
        api.registerRoute(
            'shares',
            () => api.ingest.listSharesWithPath(),
            'GET',
        ),

        api.registerRoute(
            'shares',
            async req => {
                const body = parseBody(shareCreateBody, req);
                const share = await api.ingest.createShare(body);

                return { ...share, path: api.ingest.sharePath(share.id) };
            },
            'CREATE',
        ),

        api.registerRoute(
            'shares/:id',
            async req => {
                const id = String(req.getParams().id);
                if (!api.ingest.getShare(id))
                    throw new WebError('Share not found', 404);

                await api.ingest.revokeShare(id);

                return { id };
            },
            'DELETE',
        ),

        api.registerRoute(
            'sessions/:id/show',
            async req => {
                const id = String(req.getParams().id);
                const destination = parseBody(destinationBody, req);
                if (!api.ingest.getSession(id))
                    throw new WebError('Session not found', 404);

                await manager.show(id, destination);

                return { id };
            },
            'ACTION',
        ),

        api.registerRoute(
            'sessions/:id/hide',
            async req => {
                const id = String(req.getParams().id);
                await manager.hide(id);

                return { id };
            },
            'ACTION',
        ),

        api.registerRoute(
            'sessions/:id',
            async req => {
                const id = String(req.getParams().id);
                if (!api.ingest.getSession(id))
                    throw new WebError('Session not found', 404);

                await api.ingest.closeSession(id);

                return { id };
            },
            'DELETE',
        ),
    ];
}
