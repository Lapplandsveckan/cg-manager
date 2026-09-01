import { WebError } from 'rest-exchange-protocol';
import { type RouteExport } from '../../route';
import { CasparManager } from '../../../manager';
import { type Source, type Destination } from '../../../manager/routes/routes';

const SOURCE_TYPES = ['decklink', 'video', 'channel', 'color'] as const;

function validateSource(src: unknown): src is Source {
    if (!src || typeof src !== 'object') return false;
    const source = src as Record<string, unknown>;
    if (!SOURCE_TYPES.includes(source.type as (typeof SOURCE_TYPES)[number]))
        return false;
    if (source.type === 'decklink')
        return (
            typeof source.device === 'number' &&
            typeof source.format === 'string'
        );
    if (source.type === 'video')
        return typeof source.video === 'string' && source.video.length > 0;
    if (source.type === 'channel') return typeof source.channel === 'number';
    if (source.type === 'color')
        return typeof source.color === 'string' && source.color.length > 0;
    return false;
}

function validateDestination(dest: unknown): dest is Destination {
    if (!dest || typeof dest !== 'object') return false;
    const destination = dest as Record<string, unknown>;
    if (destination.type !== 'effect-group') return false;
    if (
        typeof destination.effectLayer !== 'string' ||
        destination.effectLayer.length === 0
    )
        return false;
    if (
        destination.index !== undefined &&
        typeof destination.index !== 'number'
    )
        return false;
    return true;
}

export default {
    GET: async () => CasparManager.getManager().routes.getVideoRoutes(),
    CREATE: async request => {
        const data = request.getData();
        if (typeof data !== 'object' || data === null)
            throw new WebError('Request body must be an object', 400);

        const payload = data as Record<string, unknown>;
        if (typeof payload.name !== 'string')
            throw new WebError('`name` is required', 400);
        if (!validateSource(payload.source))
            throw new WebError('Invalid `source`', 400);
        if (!validateDestination(payload.destination))
            throw new WebError('Invalid `destination`', 400);

        return CasparManager.getManager().routes.createVideoRoute(
            {
                name: payload.name,
                source: payload.source,
                destination: payload.destination,
                enabled: (payload.enabled as boolean | undefined) ?? true,
                transform: payload.transform as number[] | undefined,
                edgeblend: payload.edgeblend as number[] | undefined,
                perspective: payload.perspective as number[] | undefined,
                metadata: payload.metadata as
                    Record<string, unknown> | undefined,
            },
            request.getClient()?.id,
        );
    },
} satisfies RouteExport;
