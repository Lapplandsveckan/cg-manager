import {WebError} from 'rest-exchange-protocol';
import {CasparManager} from '../../../../manager';

export default {
    'DELETE': async (request) => {
        if (!request.params.id) throw new WebError('Invalid request data', 400);

        const data = request.getData();
        if (typeof data !== 'string') throw new WebError('Invalid request data', 400);

        const manager = CasparManager
            .getManager();

        const rundown = manager
            .rundowns
            .getRundown(request.params.id);

        if (!rundown) throw new WebError('Rundown not found', 404);
        rundown.items = rundown.items.filter(item => item.id !== data);
        await manager.rundowns.saveRundown(rundown);

        manager
            .server
            .broadcast('rundown/entry', 'DELETE', { id: request.params.id, entry: data }, request.getClient());

        return rundown;
    },
    'UPDATE': async (request) => {
        if (!request.params.id) throw new WebError('Invalid request data', 400);

        const data = request.getData();
        if (typeof data !== 'object') throw new WebError('Invalid request data', 400);

        const manager = CasparManager
            .getManager();

        const rundown = manager
            .rundowns
            .getRundown(request.params.id);

        if (!rundown) throw new WebError('Rundown not found', 404);

        if (Array.isArray(data)) { // Batch update, and reordering of the selected items
            const updates = new Map(data.map(item => [item.id, item]));
            rundown.items = rundown.items.map(item => updates.get(item.id) ?? item);
        } else 
            rundown.items = rundown.items.map(item => item.id === data.id ? data : item);
        

        await manager.rundowns.saveRundown(rundown);

        manager
            .server
            .broadcast('rundown/entry', 'UPDATE', { id: request.params.id, entry: data }, request.getClient());

        return rundown;
    },
    'CREATE': async (request) => {
        if (!request.params.id) throw new WebError('Invalid request data', 400);

        const data = request.getData();
        if (typeof data !== 'object') throw new WebError('Invalid request data', 400);

        const manager = CasparManager
            .getManager();

        const rundown = manager
            .rundowns
            .getRundown(request.params.id);

        if (!rundown) throw new WebError('Rundown not found', 404);

        rundown.items.push(data);
        await manager.rundowns.saveRundown(rundown);

        manager
            .server
            .broadcast('rundown/entry', 'CREATE', { id: request.params.id, entry: data }, request.getClient());

        return rundown;
    },
};