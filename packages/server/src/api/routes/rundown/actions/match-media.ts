import { type RouteExport } from '../../../route';
import { parseBody } from '../../../validate';
import { CasparManager } from '../../../../manager';
import { matchMediaBody } from '../../../../schemas/rundown';

export default {
    ACTION: async request => {
        const media = parseBody(matchMediaBody, request);

        return await CasparManager.getManager().rundowns.executor.matchMedia(
            media,
        );
    },
} satisfies RouteExport;
