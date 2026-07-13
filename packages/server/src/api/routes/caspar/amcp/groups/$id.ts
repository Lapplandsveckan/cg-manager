import { WebError } from 'rest-exchange-protocol';
import { type RouteExport } from '../../../../route';
import { CasparManager } from '../../../../../manager';

export default {
    GET: async request => {
        if (!request.params.id)
            throw new WebError('No group identifier provided', 400);

        return CasparManager.getManager()
            .getExecutor()
            .findEffectGroup(decodeURIComponent(request.params.id));
    },
} satisfies RouteExport;
