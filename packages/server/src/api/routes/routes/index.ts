import { WebError } from 'rest-exchange-protocol';
import { type RouteExport } from '../../route';
import { CasparManager } from '../../../manager';

const SOURCE_TYPES = ['decklink', 'video', 'channel', 'color'] as const;

function validateSource(src: any): boolean {
    if (!src || typeof src !== 'object') return false;
    if (!SOURCE_TYPES.includes(src.type)) return false;
    if (src.type === 'decklink')
        return typeof src.device === 'number' && typeof src.format === 'string';
    if (src.type === 'video')
        return typeof src.video === 'string' && src.video.length > 0;
    if (src.type === 'channel') return typeof src.channel === 'number';
    if (src.type === 'color')
        return typeof src.color === 'string' && src.color.length > 0;
    return false;
}

function validateDestination(dest: any): boolean {
    if (!dest || typeof dest !== 'object') return false;
    if (dest.type !== 'effect-group') return false;
    if (typeof dest.effectLayer !== 'string' || dest.effectLayer.length === 0)
        return false;
    if (dest.index !== undefined && typeof dest.index !== 'number')
        return false;
    return true;
}

export default {
    GET: async () => CasparManager.getManager().routes.getVideoRoutes(),
    CREATE: async request => {
        const data = request.getData();
        if (typeof data !== 'object' || data === null)
            throw new WebError('Request body must be an object', 400);

        const payload = data as Record<string, any>;
        if (typeof payload.name !== 'string')
            throw new WebError('`name` is required', 400);
        if (!validateSource(payload.source))
            throw new WebError('Invalid `source`', 400);
        if (!validateDestination(payload.destination))
            throw new WebError('Invalid `destination`', 400);

        return CasparManager.getManager().routes.createVideoRoute({
            name: payload.name,
            source: payload.source,
            destination: payload.destination,
            enabled: payload.enabled ?? true,
            transform: payload.transform,
            edgeblend: payload.edgeblend,
            perspective: payload.perspective,
            metadata: payload.metadata,
        });
    },
} satisfies RouteExport;
