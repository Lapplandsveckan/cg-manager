import { WebError } from 'rest-exchange-protocol';
import { type RouteExport } from '../../../route';
import { CasparManager } from '../../../../manager';
import { idParams, parseParams } from '../../../validate';

export default {
    DELETE: async request => {
        const { id } = parseParams(idParams, request);
        const ingest = CasparManager.getManager().ingest;
        if (!ingest.getShare(id)) throw new WebError('Share not found', 404);

        await ingest.revokeShare(id);

        return { id };
    },
} satisfies RouteExport;
