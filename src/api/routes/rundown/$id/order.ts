import {WebError} from 'rest-exchange-protocol';
import {CasparManager} from '../../../../manager';

export default {
    'ACTION': async (request) => {
        if (!request.params.id) throw new WebError('Invalid request data', 400);

        const data = request.getData();
        if (!Array.isArray(data) || data.some(id => typeof id !== 'string'))
            throw new WebError('Body must be an array of item ids', 400);

        const manager = CasparManager.getManager();
        const rundown = manager.rundowns.getRundown(request.params.id);
        if (!rundown) throw new WebError('Rundown not found', 404);

        // Reorder items by id, defensive against unknown or missing ids.
        const remaining = new Map(rundown.items.map(item => [item.id, item]));
        const reordered = [];
        for (const id of data) {
            const item = remaining.get(id);
            if (!item) continue;
            reordered.push(item);
            remaining.delete(id);
        }
        // Append any items the client didn't mention (shouldn't happen with a
        // full list but keeps the rundown consistent if it does).
        for (const item of remaining.values()) reordered.push(item);

        rundown.items = reordered;
        await manager.rundowns.saveRundown(rundown);

        manager
            .server
            .broadcast(
                'rundown/order',
                'ACTION',
                { id: request.params.id, order: reordered.map(item => item.id) },
                request.getClient(),
            );

        return rundown;
    },
};
