import { type RouteExport } from '../../../../../route';
import { parseBody, parseParams } from '../../../../../validate';
import { CasparManager } from '../../../../../../manager';
import {
    companionParams,
    subscribeBody,
} from '../../../../../../schemas/companion';

export default {
    ACTION: async request => {
        const { plugin, id } = parseParams(companionParams, request);
        const { instanceId, options } = parseBody(subscribeBody, request);

        CasparManager.getManager().companion.subscribe(
            instanceId,
            plugin,
            id,
            options,
        );
        return null;
    },
} satisfies RouteExport;
