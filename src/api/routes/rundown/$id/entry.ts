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

        manager
            .server
            .broadcast('rundown/entry', 'UPDATE', { id: request.params.id, entry: data }, request.getClient());

        if (Array.isArray(data)) { // Batch update, and reordering of the selected items
            const ids = new Set(data.map(item => item.id));

            let index = 0;
            rundown.items = rundown.items.map(item => ids.has(item.id) ? data[index++] : item);

            return rundown;
        }

        rundown.items = rundown.items.map(item => item.id === data.id ? data : item);
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

        manager
            .server
            .broadcast('rundown/entry', 'CREATE', { id: request.params.id, entry: data }, request.getClient());

        rundown.items.push(data);
        return rundown;
    },
};