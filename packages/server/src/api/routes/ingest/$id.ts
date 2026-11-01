import { WebError } from 'rest-exchange-protocol';
import { type RouteExport } from '../../route';
import { CasparManager } from '../../../manager';
import { idParams, parseParams } from '../../validate';

export default {
    GET: async request => {
        const { id } = parseParams(idParams, request);
        const session = CasparManager.getManager().ingest.getSession(id);
        if (!session) throw new WebError('Session not found', 404);

        return session;
    },

    DELETE: async request => {
        const { id } = parseParams(idParams, request);
        const ingest = CasparManager.getManager().ingest;
        if (!ingest.getSession(id))
            throw new WebError('Session not found', 404);

        await ingest.closeSession(id);

        return { id };
    },
} satisfies RouteExport;
