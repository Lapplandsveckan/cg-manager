import { WebError } from 'rest-exchange-protocol';
import { type RouteExport } from '../../../route';
import { idParams, parseBody, parseParams } from '../../../validate';
import { CasparManager } from '../../../../manager';
import {
    entryCreateBody,
    entryDeleteBody,
    entryUpdateBody,
} from '../../../../schemas/rundown';

export default {
    DELETE: async request => {
        const { id } = parseParams(idParams, request);
        const entryId = parseBody(entryDeleteBody, request);

        const manager = CasparManager.getManager();

        const rundown = manager.rundowns.getRundown(id);

        if (!rundown) throw new WebError('Rundown not found', 404);
        rundown.items = rundown.items.filter(item => item.id !== entryId);
        await manager.rundowns.saveRundown(rundown);

        manager.server.broadcast(
            'rundown/entry',
            'DELETE',
            { id, entry: entryId },
            request.getClient(),
        );

        return rundown;
    },
    UPDATE: async request => {
        const { id } = parseParams(idParams, request);
        const data = parseBody(entryUpdateBody, request);

        const manager = CasparManager.getManager();

        const rundown = manager.rundowns.getRundown(id);

        if (!rundown) throw new WebError('Rundown not found', 404);

        const updates = new Map(
            [data].flat().map(item => [item.id, item] as const),
        );
        rundown.items = rundown.items.map(item => updates.get(item.id) ?? item);

        await manager.rundowns.saveRundown(rundown);

        manager.server.broadcast(
            'rundown/entry',
            'UPDATE',
            { id, entry: data },
            request.getClient(),
        );

        return rundown;
    },
    CREATE: async request => {
        const { id } = parseParams(idParams, request);
        const { entry, index: rawIndex } = parseBody(entryCreateBody, request);

        const manager = CasparManager.getManager();

        const rundown = manager.rundowns.getRundown(id);

        if (!rundown) throw new WebError('Rundown not found', 404);

        const index =
            rawIndex === undefined
                ? undefined
                : Math.max(
                      0,
                      Math.min(rundown.items.length, Math.floor(rawIndex)),
                  );

        if (index !== undefined) rundown.items.splice(index, 0, entry);
        else rundown.items.push(entry);

        await manager.rundowns.saveRundown(rundown);

        manager.server.broadcast(
            'rundown/entry',
            'CREATE',
            { id, entry, index },
            request.getClient(),
        );

        return rundown;
    },
} satisfies RouteExport;
