import { WebError } from 'rest-exchange-protocol';
import { type RouteExport } from '../../../route';
import { CasparManager } from '../../../../manager';

export default {
    ACTION: async request => {
        const data = request.getData();
        if (typeof data !== 'object' || data === null)
            throw new WebError('Invalid request data', 400);

        const { mediaId, name, type } = data as {
            mediaId?: unknown;
            name?: unknown;
            type?: unknown;
        };
        if (typeof mediaId !== 'string' || !mediaId)
            throw new WebError('Invalid mediaId', 400);
        if (typeof name !== 'string' || !name)
            throw new WebError('Invalid name', 400);
        if (typeof type !== 'string') throw new WebError('Invalid type', 400);

        return await CasparManager.getManager().rundowns.executor.matchMedia({
            mediaId,
            name,
            type,
        });
    },
} satisfies RouteExport;
