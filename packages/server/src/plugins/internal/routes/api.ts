import { type PluginAPI } from '@lappis/cg-manager';
import { WebError } from 'rest-exchange-protocol';
import { type VideoRoutesManager } from './manager';
import { type Destination, type Source, type VideoRoute } from './types';

const SOURCE_TYPES = ['decklink', 'video', 'channel', 'color'];

const isNonEmptyString = (value: unknown) =>
    typeof value === 'string' && value.length > 0;

function validateSource(src: unknown): src is Source {
    if (!src || typeof src !== 'object') return false;

    const source = src as Record<string, unknown>;
    if (!SOURCE_TYPES.includes(source.type as string)) return false;
    if (source.type === 'decklink')
        return (
            typeof source.device === 'number' &&
            typeof source.format === 'string'
        );
    if (source.type === 'video') return isNonEmptyString(source.video);
    if (source.type === 'channel') return typeof source.channel === 'number';
    return isNonEmptyString(source.color);
}

function validateDestination(dest: unknown): dest is Destination {
    if (!dest || typeof dest !== 'object') return false;

    const destination = dest as Record<string, unknown>;
    if (destination.type !== 'effect-group') return false;
    if (!isNonEmptyString(destination.effectLayer)) return false;
    return (
        destination.index === undefined || typeof destination.index === 'number'
    );
}

function requireBody(data: unknown) {
    if (typeof data !== 'object' || data === null)
        throw new WebError('Request body must be an object', 400);

    return data as Record<string, unknown>;
}

function requireId(params: Record<string, string>) {
    if (!params.id) throw new WebError('No id', 400);
    return params.id;
}

function requireRoute(manager: VideoRoutesManager, id: string) {
    const route = manager.get(id);
    if (!route) throw new WebError('Route not found', 404);
    return route;
}

function mergeRoute(existing: VideoRoute, payload: Partial<VideoRoute>) {
    return {
        id: existing.id,
        name: payload.name ?? existing.name,
        source: payload.source ?? existing.source,
        destination: payload.destination ?? existing.destination,
        enabled: payload.enabled ?? existing.enabled,
        ...(payload.transform ? { transform: payload.transform } : {}),
        ...(payload.edgeblend ? { edgeblend: payload.edgeblend } : {}),
        ...(payload.perspective ? { perspective: payload.perspective } : {}),
        ...(payload.metadata ? { metadata: payload.metadata } : {}),
    } satisfies VideoRoute;
}

export function registerRouteEndpoints(
    api: PluginAPI,
    manager: VideoRoutesManager,
) {
    return [
        api.registerRoute('routes', async () => manager.list(), 'GET'),

        api.registerRoute(
            'routes',
            async request => {
                const payload = requireBody(request.getData());
                if (typeof payload.name !== 'string')
                    throw new WebError('`name` is required', 400);
                if (!validateSource(payload.source))
                    throw new WebError('Invalid `source`', 400);
                if (!validateDestination(payload.destination))
                    throw new WebError('Invalid `destination`', 400);

                return manager.create(
                    {
                        name: payload.name,
                        source: payload.source,
                        destination: payload.destination,
                        enabled: (payload.enabled as boolean) ?? true,
                        transform: payload.transform as number[],
                        edgeblend: payload.edgeblend as number[],
                        perspective: payload.perspective as number[],
                        metadata: payload.metadata as Record<string, unknown>,
                    },
                    request.getClient(),
                );
            },
            'CREATE',
        ),

        api.registerRoute(
            'routes/:id',
            async request =>
                requireRoute(manager, requireId(request.getParams())),
            'GET',
        ),

        api.registerRoute(
            'routes/:id',
            async request => {
                const id = requireId(request.getParams());
                await manager.delete(id, request.getClient());
                return { ok: true };
            },
            'DELETE',
        ),

        api.registerRoute(
            'routes/:id',
            async request => {
                const id = requireId(request.getParams());
                const payload = requireBody(request.getData());
                const existing = requireRoute(manager, id);

                const next = mergeRoute(
                    existing,
                    payload as Partial<VideoRoute>,
                );
                await manager.update(next, request.getClient());
                return manager.get(id);
            },
            'UPDATE',
        ),

        api.registerRoute(
            'routes/:id/enable',
            async request => {
                const id = requireId(request.getParams());
                manager.setEnabled(id, true, request.getClient());
                return requireRoute(manager, id);
            },
            'ACTION',
        ),

        api.registerRoute(
            'routes/:id/disable',
            async request => {
                const id = requireId(request.getParams());
                manager.setEnabled(id, false, request.getClient());
                return requireRoute(manager, id);
            },
            'ACTION',
        ),
    ];
}
