import { WebError } from 'rest-exchange-protocol';
import { type RouteExport } from '../../../route';
import { CasparManager } from '../../../../manager';
import { type RundownItem } from '../../../../manager/rundown/rundown';

export default {
    DELETE: async request => {
        if (!request.params.id) throw new WebError('Invalid request data', 400);

        const data = request.getData();
        if (typeof data !== 'string')
            throw new WebError('Invalid request data', 400);

        const manager = CasparManager.getManager();

        const rundown = manager.rundowns.getRundown(request.params.id);

        if (!rundown) throw new WebError('Rundown not found', 404);
        rundown.items = rundown.items.filter(item => item.id !== data);
        await manager.rundowns.saveRundown(rundown);

        manager.server.broadcast(
            'rundown/entry',
            'DELETE',
            { id: request.params.id, entry: data },
            request.getClient(),
        );

        return rundown;
    },
    UPDATE: async request => {
        if (!request.params.id) throw new WebError('Invalid request data', 400);

        const data = request.getData();
        if (typeof data !== 'object')
            throw new WebError('Invalid request data', 400);

        const manager = CasparManager.getManager();

        const rundown = manager.rundowns.getRundown(request.params.id);

        if (!rundown) throw new WebError('Rundown not found', 404);

        if (Array.isArray(data)) {
            // Batch update, and reordering of the selected items
            const updates = new Map(
                (data as RundownItem[]).map(item => [item.id, item]),
            );
            rundown.items = rundown.items.map(
                item => updates.get(item.id) ?? item,
            );
        } else {
            rundown.items = rundown.items.map(item =>
                item.id === (data as RundownItem).id
                    ? (data as RundownItem)
                    : item,
            );
        }

        await manager.rundowns.saveRundown(rundown);

        manager.server.broadcast(
            'rundown/entry',
            'UPDATE',
            { id: request.params.id, entry: data },
            request.getClient(),
        );

        return rundown;
    },
    CREATE: async request => {
        if (!request.params.id) throw new WebError('Invalid request data', 400);

        const data = request.getData();
        if (typeof data !== 'object' || data === null)
            throw new WebError('Invalid request data', 400);

        const manager = CasparManager.getManager();

        const rundown = manager.rundowns.getRundown(request.params.id);

        if (!rundown) throw new WebError('Rundown not found', 404);

        // Accept either a bare entry (legacy: append to the end) or
        // { entry, index } to insert at a specific position. The index is
        // clamped so out-of-range values silently fall back to append/prepend.
        const wrapped = data as { entry?: unknown; index?: unknown };
        const hasWrapper =
            wrapped.entry !== undefined && typeof wrapped.entry === 'object';
        const entry = hasWrapper
            ? (wrapped.entry as RundownItem)
            : (data as RundownItem);
        const rawIndex = hasWrapper ? wrapped.index : undefined;
        const index =
            typeof rawIndex === 'number' && Number.isFinite(rawIndex)
                ? Math.max(
                      0,
                      Math.min(rundown.items.length, Math.floor(rawIndex)),
                  )
                : undefined;

        if (index !== undefined) rundown.items.splice(index, 0, entry);
        else rundown.items.push(entry);

        await manager.rundowns.saveRundown(rundown);

        manager.server.broadcast(
            'rundown/entry',
            'CREATE',
            { id: request.params.id, entry, index },
            request.getClient(),
        );

        return rundown;
    },
} satisfies RouteExport;
