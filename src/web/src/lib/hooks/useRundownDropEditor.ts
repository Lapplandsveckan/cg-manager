import { useState } from 'react';
import type { RundownEntry } from '../../components/Rundowns';
import type { RundownItemDragPayload } from '../dragPayload';

/**
 * Shared state/handlers for the "drop a plugin payload onto a rundown"
 * flow, used by both the full Rundown page and the QuickActions panel.
 * Normally opens the editor modal pre-filled from the payload; when the
 * payload sets `immediate`, creates the entry directly instead.
 */
export function useRundownDropEditor(
    createEntry: (entry: RundownEntry, index?: number) => void,
    defaultTitle: string,
) {
    const [editing, setEditingRaw] = useState<RundownEntry | null>(null);
    const [pendingDropIndex, setPendingDropIndex] = useState<
        number | undefined
    >(undefined);

    const setEditing = (next: RundownEntry | null) => {
        setEditingRaw(next);
        if (next === null) setPendingDropIndex(undefined);
    };

    const newEntryFromPayload = (
        payload: RundownItemDragPayload,
    ): RundownEntry => ({
        id: Math.random().toString(36).substring(2, 11),
        title: payload.title ?? defaultTitle,
        type: payload.type,
        data: payload.data ?? {},
    });

    const openEditorForDrop = (
        payload: RundownItemDragPayload,
        index?: number,
    ) => {
        if (payload.immediate) {
            createEntry(newEntryFromPayload(payload), index);
            return;
        }
        setEditingRaw(newEntryFromPayload(payload));
        setPendingDropIndex(index);
    };

    const createEntryAtPending = (entry: RundownEntry) =>
        createEntry(entry, pendingDropIndex);

    return { editing, setEditing, openEditorForDrop, createEntryAtPending };
}
