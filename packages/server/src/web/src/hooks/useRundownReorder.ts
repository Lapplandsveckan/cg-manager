import { type RefObject, useCallback, useRef, useState } from 'react';
import {
    readReorderPayload,
    writeReorderPayload,
    type RundownItemDragPayload,
} from '../lib/dragPayload';
import { type RundownEntry } from '../lib/query/rundownEntries';
import { useDropIndex } from './useDropIndex';

function moveEntry(
    entries: RundownEntry[],
    fromIndex: number,
    toIndex: number,
): string[] | null {
    if (fromIndex === toIndex) return null;
    const next = [...entries];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next.map(entry => entry.id);
}

// `dropIndex` is measured against the list as it looks *before* the dragged
// card is removed. Once that card is spliced out, every slot after it shifts
// left by one, so a drop index that falls after the source needs the same
// correction before it can be used as the splice target.
function adjustIndexForRemoval(fromIndex: number, dropIndex: number): number {
    return fromIndex < dropIndex ? dropIndex - 1 : dropIndex;
}

// Cross-list drops always copy, never move — the payload only needs the
// entry's content, not its id (a fresh one is minted at the destination).
function toCrossListCopyPayload(entry: RundownEntry): RundownItemDragPayload {
    return {
        type: entry.type,
        data: entry.data,
        title: entry.title,
        immediate: true,
    };
}

interface UseRundownReorderOptions {
    rundownId: string;
    entries: RundownEntry[];
    listRef: RefObject<HTMLElement>;
    onReorder?: (orderedIds: string[]) => void;
    onDropItem?: (payload: RundownItemDragPayload, index?: number) => void;
}

/**
 * Drag-to-reorder state machine for a rundown list. Also handles a reorder
 * payload dropped from a *different* Rundowns instance (e.g. main rundown
 * <-> quick actions) by copying the entry via `onDropItem` instead of
 * reordering.
 */
export function useRundownReorder({
    rundownId,
    entries,
    listRef,
    onReorder,
    onDropItem,
}: UseRundownReorderOptions) {
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [draggingHeight, setDraggingHeight] = useState(0);
    // Marked synchronously by applyReorderDrop so dragend can skip the
    // outside-container path without relying on render timing.
    const didDropInsideRef = useRef(false);

    const {
        dropIndex,
        setDropIndex,
        dropIndexRef,
        grabOffsetRef,
        computeDropIndex,
    } = useDropIndex(listRef, Boolean(draggingId));

    const clearReorderState = useCallback(() => {
        setDropIndex(null);
        setDraggingId(null);
        setDraggingHeight(0);
        grabOffsetRef.current = 0;
    }, [setDropIndex, grabOffsetRef]);

    const startReorderDrag = useCallback(
        (
            e: React.DragEvent<HTMLDivElement>,
            entry: RundownEntry,
            height: number,
            offset: number,
        ) => {
            writeReorderPayload(e.dataTransfer, { rundownId, entry });
            setDraggingHeight(height);
            grabOffsetRef.current = offset;
            // Defer so the drag image is captured before the card collapses.
            requestAnimationFrame(() => setDraggingId(entry.id));
        },
        [rundownId, grabOffsetRef],
    );

    const applyReorderDrop = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            const parsed = readReorderPayload(e.dataTransfer);
            if (!parsed || dropIndex === null) {
                clearReorderState();
                return;
            }
            const index = dropIndex;

            // Assumes distinct Rundowns instances never share a rundownId — if
            // they did, this would misfire as a same-list reorder here.
            const isCrossListDrag = parsed.rundownId !== rundownId;
            if (isCrossListDrag) {
                // Entry dragged in from a different Rundowns instance (e.g. the
                // main rundown <-> quick actions) — copy it here; the source
                // keeps its own entry (cross-list drags don't remove it).
                clearReorderState();
                if (!onDropItem) {
                    e.dataTransfer.dropEffect = 'none';
                    return;
                }
                e.preventDefault();
                onDropItem(toCrossListCopyPayload(parsed.entry), index);
                return;
            }

            if (!onReorder) {
                clearReorderState();
                return;
            }

            const fromIndex = entries.findIndex(
                en => en.id === parsed.entry.id,
            );
            if (fromIndex < 0) {
                clearReorderState();
                return;
            }
            e.preventDefault();

            // Mark before clearing so dragend (fired after drop) skips the outside-container path.
            didDropInsideRef.current = true;
            const toIndex = adjustIndexForRemoval(fromIndex, index);
            clearReorderState();

            const reordered = moveEntry(entries, fromIndex, toIndex);
            if (reordered) onReorder(reordered);
        },
        [
            rundownId,
            entries,
            dropIndex,
            onReorder,
            onDropItem,
            clearReorderState,
        ],
    );

    const handleReorderDragEnd = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            if (didDropInsideRef.current) {
                didDropInsideRef.current = false;
                clearReorderState();
                return;
            }

            if (e.dataTransfer.dropEffect !== 'none') {
                // Accepted by a different Rundowns instance — it already
                // created its own copy of this entry, and cross-list drags
                // are copy-only, so there's nothing further to do here.
                clearReorderState();
                return;
            }

            const idx = dropIndexRef.current;
            if (idx !== null && draggingId && onReorder) {
                const fromIndex = entries.findIndex(en => en.id === draggingId);
                if (fromIndex >= 0) {
                    const toIndex = adjustIndexForRemoval(fromIndex, idx);
                    const reordered = moveEntry(entries, fromIndex, toIndex);
                    if (reordered) onReorder(reordered);
                }
            }
            clearReorderState();
        },
        [draggingId, entries, onReorder, dropIndexRef, clearReorderState],
    );

    return {
        dropIndex,
        setDropIndex,
        computeDropIndex,
        draggingId,
        draggingHeight,
        startReorderDrag,
        handleReorderDragEnd,
        applyReorderDrop,
    };
}
