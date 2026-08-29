import type React from 'react';
import {
    entryDeleted,
    entryUpdated,
    entriesReordered,
    routeDeleted,
    routeUpdated,
    rundownDeleted,
    rundownRenamed,
} from '../lib/api/broadcasts';
import { useBroadcast } from '../lib/hooks/useBroadcast';
import { invalidate } from '../lib/undo/undoStore';
import { routeScope, rundownScope } from '../lib/undo/tools';

/** Renderless mount point for the broadcast listeners that invalidate stale
 *  undo entries. Split out of UndoProvider so that component stays focused
 *  on the undo/redo stack itself. Mirrors QuerySync's pattern. */
export const UndoInvalidationSync: React.FC = () => {
    useBroadcast(entryUpdated, ({ id, entry }) => {
        const entries = Array.isArray(entry) ? entry : [entry];
        invalidate(entries.map(e => rundownScope(id, `entry:${e.id}`)));
    });

    useBroadcast(entryDeleted, ({ id, entry }) => {
        invalidate([rundownScope(id, `entry:${entry}`)]);
    });

    useBroadcast(entriesReordered, ({ id }) => {
        invalidate([rundownScope(id, 'order')]);
    });

    useBroadcast(rundownRenamed, ({ id }) => {
        invalidate([rundownScope(id, 'name')]);
    });

    useBroadcast(rundownDeleted, id => {
        invalidate([rundownScope(id)]);
    });

    useBroadcast(routeUpdated, ({ id }) => {
        invalidate([routeScope(id)]);
    });

    useBroadcast(routeDeleted, id => {
        invalidate([routeScope(id)]);
    });

    return null;
};
