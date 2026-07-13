import { WebError } from 'rest-exchange-protocol';
import { type RouteExport } from '../../../../../route';
import { CasparManager } from '../../../../../../manager';

export default {
    ACTION: async request => {
        const { plugin, id } = request.params as {
            plugin?: string;
            id?: string;
        };
        if (!plugin) throw new WebError('Missing plugin', 400);
        if (!id) throw new WebError('Missing id', 400);

        const body = (request.getData() ?? {}) as Record<string, unknown>;
        if (typeof body.instanceId !== 'string')
            throw new WebError('Missing instanceId', 400);

        CasparManager.getManager().companion.unsubscribe(body.instanceId);
        return null;
    },
} satisfies RouteExport;
