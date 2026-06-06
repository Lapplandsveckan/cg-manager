import {type RefObject, useEffect} from 'react';

/**
 * Auto-scrolls the referenced element when a drag is in progress and the
 * cursor is near its top or bottom edge — same affordance most native
 * apps and file managers offer.
 *
 * Speed ramps linearly from `MIN_SPEED` at the outer edge of the trigger
 * zone to `MAX_SPEED` at the very edge of the container. The `EDGE_ZONE`
 * cap means scrolling never accelerates indefinitely.
 */
const EDGE_ZONE = 72;       // px from top/bottom edge that triggers scroll
const MIN_SPEED = 2;        // px per frame at the boundary of the zone
const MAX_SPEED = 18;       // px per frame at the very edge

function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
}

export function useDragAutoScroll(ref: RefObject<HTMLElement>) {
    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        let raf: number | null = null;
        let speed = 0;

        const step = () => {
            if (speed === 0) {
                raf = null;
                return;
            }
            el.scrollTop += speed;
            raf = requestAnimationFrame(step);
        };

        const onDragOver = (e: DragEvent) => {
            const rect = el.getBoundingClientRect();
            const y = e.clientY;

            // Outside the element bounds — leave speed alone; dragleave
            // (handler below) will zero it once we've actually left.
            if (y < rect.top || y > rect.bottom) return;

            const fromTop = y - rect.top;
            const fromBottom = rect.bottom - y;

            let next = 0;
            if (fromTop < EDGE_ZONE) {
                const ratio = 1 - fromTop / EDGE_ZONE;
                next = -lerp(MIN_SPEED, MAX_SPEED, ratio);
            } else if (fromBottom < EDGE_ZONE) {
                const ratio = 1 - fromBottom / EDGE_ZONE;
                next = lerp(MIN_SPEED, MAX_SPEED, ratio);
            }

            speed = next;
            if (speed !== 0 && raf === null)
                raf = requestAnimationFrame(step);
        };

        const stop = () => {
            speed = 0;
            if (raf !== null) {
                cancelAnimationFrame(raf);
                raf = null;
            }
        };

        const onDragLeave = (e: DragEvent) => {
            // dragleave fires when the cursor enters a child too — only
            // stop when the cursor has actually exited this element.
            const related = e.relatedTarget as Node | null;
            if (!related || !el.contains(related)) stop();
        };

        el.addEventListener('dragover', onDragOver);
        el.addEventListener('dragleave', onDragLeave);
        el.addEventListener('drop', stop);
        window.addEventListener('dragend', stop);

        return () => {
            stop();
            el.removeEventListener('dragover', onDragOver);
            el.removeEventListener('dragleave', onDragLeave);
            el.removeEventListener('drop', stop);
            window.removeEventListener('dragend', stop);
        };
    }, [ref]);
}
