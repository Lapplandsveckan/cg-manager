import { type RouteExport } from '../../../../../route';
import { parseBody } from '../../../../../validate';
import { CasparManager } from '../../../../../../manager';
import { unsubscribeBody } from '../../../../../../schemas/companion';

export default {
    ACTION: async request => {
        const { instanceId } = parseBody(unsubscribeBody, request);

        CasparManager.getManager().companion.unsubscribe(instanceId);
        return null;
    },
} satisfies RouteExport;
