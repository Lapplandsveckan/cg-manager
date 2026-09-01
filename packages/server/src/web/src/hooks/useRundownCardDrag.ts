import { useCallback, useRef } from 'react';

interface UseRundownCardDragOptions {
    onReorderDragStart?: (
        e: React.DragEvent<HTMLDivElement>,
        height: number,
        grabOffset: number,
    ) => void;
    onReorderDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
}

/** Wires a card's native drag events to the reorder callbacks: captures the
 *  card's own element as the drag image (the browser default is otherwise a
 *  blank ghost) and reports the grab point relative to the card. */
export function useRundownCardDrag({
    onReorderDragStart,
    onReorderDragEnd,
}: UseRundownCardDragOptions) {
    const cardRef = useRef<HTMLDivElement>(null);

    const handleDragStart = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            const rect = cardRef.current?.getBoundingClientRect();
            if (cardRef.current && rect) {
                e.dataTransfer.setDragImage(
                    cardRef.current,
                    e.clientX - rect.left,
                    e.clientY - rect.top,
                );
            }
            onReorderDragStart?.(
                e,
                rect?.height ?? 64,
                e.clientY - (rect?.top ?? e.clientY),
            );
        },
        [onReorderDragStart],
    );

    const handleDragEnd = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => onReorderDragEnd?.(e),
        [onReorderDragEnd],
    );

    return { cardRef, handleDragStart, handleDragEnd };
}
