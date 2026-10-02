import { WebError } from 'rest-exchange-protocol';
import { type RouteExport } from '../../../route';
import { idParams, parseBody, parseParams } from '../../../validate';
import { CasparManager } from '../../../../manager';
import { orderBody } from '../../../../schemas/rundown';

export default {
    ACTION: async request => {
        const { id } = parseParams(idParams, request);
        const order = parseBody(orderBody, request);

        const manager = CasparManager.getManager();
        const rundown = manager.rundowns.getRundown(id);
        if (!rundown) throw new WebError('Rundown not found', 404);

        const remaining = new Map(rundown.items.map(item => [item.id, item]));
        const reordered = [];
        for (const itemId of order) {
            const item = remaining.get(itemId);
            if (!item) continue;
            reordered.push(item);
            remaining.delete(itemId);
        }
        for (const item of remaining.values()) reordered.push(item);

        rundown.items = reordered;
        await manager.rundowns.saveRundown(rundown);

        manager.server.broadcast(
            'rundown/order',
            'ACTION',
            { id, order: reordered.map(item => item.id) },
            request.getClient(),
        );

        return rundown;
    },
} satisfies RouteExport;
