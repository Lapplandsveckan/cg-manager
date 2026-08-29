import type React from 'react';
import { useSocket } from '../lib/hooks/useSocket';
import { invalidate } from '../lib/undo/undoStore';
import { routeScope, rundownScope } from '../lib/undo/tools';
import { useWsBroadcast } from '../lib/query/useWsBroadcast';

/** Renderless mount point for the broadcast listeners that invalidate stale
 *  undo entries. Split out of UndoProvider so that component stays focused
 *  on the undo/redo stack itself. Mirrors QuerySync's pattern. */
export const UndoInvalidationSync: React.FC = () => {
    const conn = useSocket();

    useWsBroadcast(conn, 'rundown/entry', 'UPDATE', data => {
        const { id, entry } = data as { id: string; entry: unknown };
        const entries = Array.isArray(entry) ? entry : [entry];
        invalidate(
            entries
                .filter((e): e is { id: string } =>
                    Boolean((e as { id?: string })?.id),
                )
                .map(e => rundownScope(id, `entry:${e.id}`)),
        );
    });

    useWsBroadcast(conn, 'rundown/entry', 'DELETE', data => {
        const { id, entry } = data as { id: string; entry: string };
        invalidate([rundownScope(id, `entry:${entry}`)]);
    });

    useWsBroadcast(conn, 'rundown/order', 'ACTION', data => {
        const { id } = data as { id: string };
        invalidate([rundownScope(id, 'order')]);
    });

    useWsBroadcast(conn, 'rundown', 'UPDATE', data => {
        const { id } = data as { id: string };
        invalidate([rundownScope(id, 'name')]);
    });

    useWsBroadcast(conn, 'rundown', 'DELETE', data => {
        if (typeof data === 'string') invalidate([rundownScope(data)]);
    });

    useWsBroadcast(conn, 'routes', 'UPDATE', data => {
        const route = data as { id?: string };
        if (!route?.id) return;
        invalidate([routeScope(route.id)]);
    });

    useWsBroadcast(conn, 'routes', 'DELETE', data => {
        if (typeof data !== 'string') return;
        invalidate([routeScope(data)]);
    });

    return null;
};
