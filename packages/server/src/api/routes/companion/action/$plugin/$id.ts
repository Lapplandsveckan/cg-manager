import { type RouteExport } from '../../../../route';
import { parseBody, parseParams } from '../../../../validate';
import { CasparManager } from '../../../../../manager';
import { actionBody, companionParams } from '../../../../../schemas/companion';

export default {
    ACTION: async request => {
        const { plugin, id } = parseParams(companionParams, request);
        const { options, surface } = parseBody(actionBody, request);

        await CasparManager.getManager().companion.invoke(plugin, id, options, {
            surface,
        });
        return null;
    },
} satisfies RouteExport;
