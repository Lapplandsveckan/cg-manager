import { WebError } from 'rest-exchange-protocol';
import { type RouteExport } from '../../../../route';
import { CasparManager } from '../../../../../manager';

export default {
    GET: async request => {
        if (!request.params.id)
            throw new WebError('No effect id provided', 400);

        return CasparManager.getManager()
            .getExecutor()
            .getEffect(request.params.id)
            ?.toJSON();
    },
} satisfies RouteExport;
