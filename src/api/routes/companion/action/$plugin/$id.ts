import { WebError } from 'rest-exchange-protocol';
import { type RouteExport } from '../../../../route';
import { CasparManager } from '../../../../../manager';

export default {
    ACTION: async request => {
        const { plugin, id } = request.params as {
            plugin?: string;
            id?: string;
        };
        if (!plugin) throw new WebError('Missing plugin', 400);
        if (!id) throw new WebError('Missing id', 400);

        const body = (request.getData() ?? {}) as Record<string, unknown>;
        const options = (body.options ?? {}) as Record<
            string,
            string | number | boolean
        >;
        const ctx = {
            surface:
                typeof body.surface === 'string' ? body.surface : undefined,
        };

        await CasparManager.getManager().companion.invoke(
            plugin,
            id,
            options,
            ctx,
        );
        return null;
    },
} satisfies RouteExport;
