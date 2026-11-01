import { type RouteExport } from '../../../route';
import { CasparManager } from '../../../../manager';
import { parseBody } from '../../../validate';
import { shareCreateBody } from '../../../../schemas/ingest';

export default {
    GET: async () => CasparManager.getManager().ingest.listSharesWithPath(),

    CREATE: async request => {
        const body = parseBody(shareCreateBody, request);
        const ingest = CasparManager.getManager().ingest;
        const share = await ingest.createShare(body);

        return { ...share, path: ingest.sharePath(share.id) };
    },
} satisfies RouteExport;
