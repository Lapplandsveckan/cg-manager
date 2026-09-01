import {
    type RefObject,
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';

// MUI Stack spacing={1.5} on the card list = 1.5 * 8px.
const CARD_GAP_PX = 12;

// Cards report their own height via [data-card] rather than reading
// getBoundingClientRect().bottom off the list — an open gap spacer between
// cards shifts that live layout and would produce the wrong measurement.
// [data-card] is a sibling of the gap boxes, so its height stays
// gap-independent no matter which gap is currently open.
function getCardHeights(list: HTMLElement | null): number[] {
    const cards = Array.from(
        list?.querySelectorAll('[data-card]') ?? [],
    ) as HTMLElement[];
    return cards.map(card => card.getBoundingClientRect().height);
}

// Subtracts scrollTop so the result tracks the list's content origin (the
// position its first card would have at scrollTop 0) rather than its
// on-screen position, which would drift as the user scrolls mid-drag.
function getListContentTop(list: HTMLElement | null): number {
    const top = list?.getBoundingClientRect().top ?? 0;
    const scrollTop = list?.scrollTop ?? 0;
    return top - scrollTop;
}

// Walks the cards top-down, accumulating height + gap, and returns how many
// are fully above `offsetFromTop` — that count is exactly the index a drop
// at that offset should land at.
function countCardsAbove(offsetFromTop: number, cardHeights: number[]): number {
    let bottomOfLastCard = 0;
    for (let i = 0; i < cardHeights.length; i++) {
        const gapBeforeThisCard = i > 0 ? CARD_GAP_PX : 0;
        bottomOfLastCard += gapBeforeThisCard + cardHeights[i];
        if (bottomOfLastCard > offsetFromTop) return i;
    }
    return cardHeights.length;
}

/**
 * Tracks the index in a card list where a drag-in-progress would land if
 * dropped right now. Shared by the reorder and create-drop paths in
 * `RundownList`, since both need to show the same gap indicator.
 */
export function useDropIndex(
    listRef: RefObject<HTMLElement>,
    tracking: boolean,
) {
    const [dropIndex, setDropIndex] = useState<number | null>(null);
    // Mirrored each render so dragend reads the latest value without stale closures.
    const dropIndexRef = useRef<number | null>(null);
    dropIndexRef.current = dropIndex;
    // Written synchronously so computeDropIndex sees the correct offset on the
    // first dragover without waiting for a re-render.
    const grabOffsetRef = useRef(0);

    // Reads only refs, so this never needs to change identity.
    const computeDropIndex = useCallback(
        (clientY: number): number => {
            const list = listRef.current;
            const listTop = getListContentTop(list);
            const offsetFromTop = clientY - grabOffsetRef.current - listTop;
            return countCardsAbove(offsetFromTop, getCardHeights(list));
        },
        [listRef],
    );

    // Track cursor Y globally so the gap stays visible when dragging outside the container.
    useEffect(() => {
        if (!tracking) return;
        const handler = (e: DragEvent) => {
            e.preventDefault();
            setDropIndex(computeDropIndex(e.clientY));
        };
        document.addEventListener('dragover', handler);
        return () => document.removeEventListener('dragover', handler);
    }, [tracking, computeDropIndex]);

    return {
        dropIndex,
        setDropIndex,
        dropIndexRef,
        grabOffsetRef,
        computeDropIndex,
    };
}
