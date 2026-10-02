import { type RouteExport } from '../../../route';
import { parseBody } from '../../../validate';
import { CasparManager } from '../../../../manager';
import { matchBody } from '../../../../schemas/rundown';

export default {
    ACTION: async request => {
        const file = parseBody(matchBody, request);

        return await CasparManager.getManager().rundowns.executor.matchFile(
            file,
        );
    },
} satisfies RouteExport;
