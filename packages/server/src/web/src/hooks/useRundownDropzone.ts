import { useState } from 'react';
import type React from 'react';
import {
    hasReorderPayload,
    hasRundownItemPayload,
    isFileDrag,
    parseRundownItemPayload,
    type RundownItemDragPayload,
} from '../lib/dragPayload';

interface UseRundownDropzoneOptions {
    acceptsDrop: boolean;
    acceptsReorder: boolean;
    draggingId: string | null;
    dropIndex: number | null;
    setDropIndex: (index: number | null) => void;
    computeDropIndex: (clientY: number) => number;
    applyReorderDrop: (e: React.DragEvent<HTMLDivElement>) => void;
    onFileDrop: (files: File[], baseIndex: number | undefined) => void;
    onDropItem?: (payload: RundownItemDragPayload, index?: number) => void;
}

/** Routes a drag over the list container to one of three destinations:
 *  a same-shape reorder, a file drop (matched against actions and uploaded),
 *  or a plugin-authored create payload. */
export function useRundownDropzone({
    acceptsDrop,
    acceptsReorder,
    draggingId,
    dropIndex,
    setDropIndex,
    computeDropIndex,
    applyReorderDrop,
    onFileDrop,
    onDropItem,
}: UseRundownDropzoneOptions) {
    const [dragOver, setDragOver] = useState(false);

    const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        const isReorder = hasReorderPayload(e.dataTransfer);
        const isCreate =
            acceptsDrop &&
            (hasRundownItemPayload(e.dataTransfer) ||
                isFileDrag(e.dataTransfer));

        // Accept a reorder-shaped drag either for a same-list reorder or for
        // an existing entry arriving from a different Rundowns instance —
        // the latter only needs onDropItem, not onReorder.
        if (isReorder && (acceptsReorder || acceptsDrop)) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setDropIndex(computeDropIndex(e.clientY));
            return;
        }
        if (isCreate) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            if (!dragOver) setDragOver(true);
            setDropIndex(computeDropIndex(e.clientY));
        }
    };

    const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        // Only flip off when the drag actually leaves the wrapper, not when
        // moving between nested children.
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragOver(false);
        if (!draggingId) {
            setDropIndex(null);
            return;
        }
        // Cursor left the container during a reorder drag. Snap to the nearest
        // edge immediately (0 if above, entries.length if below/side) so the gap
        // doesn't vanish while the document handler takes over continuous tracking.
        setDropIndex(computeDropIndex(e.clientY));
    };

    const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
        if (hasReorderPayload(e.dataTransfer)) {
            applyReorderDrop(e);
            return;
        }
        if (!acceptsDrop) return;

        if (isFileDrag(e.dataTransfer)) {
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files);
            const index = dropIndex ?? undefined;
            setDragOver(false);
            setDropIndex(null);
            if (files.length) void onFileDrop(files, index);
            return;
        }

        const payload = parseRundownItemPayload(e.dataTransfer);
        setDragOver(false);
        if (!payload) {
            setDropIndex(null);
            return;
        }
        e.preventDefault();

        const index = dropIndex ?? undefined;
        setDropIndex(null);
        onDropItem?.(payload, index);
    };

    return { dragOver, handlers: { onDragOver, onDragLeave, onDrop } };
}
