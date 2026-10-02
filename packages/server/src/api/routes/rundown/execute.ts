import { type RouteExport } from '../../route';
import { parseBody } from '../../validate';
import { CasparManager } from '../../../manager';
import { executeBody } from '../../../schemas/rundown';

export default {
    ACTION: async request => {
        const { entry } = parseBody(executeBody, request);

        await CasparManager.getManager().rundowns.executor.executeItem(entry);
    },
} satisfies RouteExport;
