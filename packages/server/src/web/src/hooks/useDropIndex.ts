import {
    type RefObject,
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';

// MUI Stack spacing={1.5} on the card list = 1.5 * 8px.
const CARD_GAP_PX = 12;

// Card height comes from [data-card]: open gap spacers shift live list layout
function getCardHeights(list: HTMLElement | null): number[] {
    const cards = Array.from(
        list?.querySelectorAll('[data-card]') ?? [],
    ) as HTMLElement[];
    return cards.map(card => card.getBoundingClientRect().height);
}

function getListContentTop(list: HTMLElement | null): number {
    const top = list?.getBoundingClientRect().top ?? 0;
    const scrollTop = list?.scrollTop ?? 0;
    return top - scrollTop;
}

function countCardsAbove(offsetFromTop: number, cardHeights: number[]): number {
    let bottomOfLastCard = 0;
    for (let i = 0; i < cardHeights.length; i++) {
        const gapBeforeThisCard = i > 0 ? CARD_GAP_PX : 0;
        bottomOfLastCard += gapBeforeThisCard + cardHeights[i];
        if (bottomOfLastCard > offsetFromTop) return i;
    }
    return cardHeights.length;
}

export function useDropIndex(
    listRef: RefObject<HTMLElement>,
    tracking: boolean,
) {
    const [dropIndex, setDropIndex] = useState<number | null>(null);
    const dropIndexRef = useRef<number | null>(null);
    dropIndexRef.current = dropIndex;
    const grabOffsetRef = useRef(0);

    const computeDropIndex = useCallback(
        (clientY: number): number => {
            const list = listRef.current;
            const listTop = getListContentTop(list);
            const offsetFromTop = clientY - grabOffsetRef.current - listTop;
            return countCardsAbove(offsetFromTop, getCardHeights(list));
        },
        [listRef],
    );

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
