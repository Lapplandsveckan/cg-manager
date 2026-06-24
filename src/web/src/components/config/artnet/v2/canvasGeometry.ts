import { type V2Fixture } from '../types';

export type Handle = 'move' | 'tl' | 'tr' | 'br' | 'bl' | 'rotate';

export interface DragState {
    fixtureIndex: number;
    handle: Handle;
    startMouseCanvas: { x: number; y: number }; // canvas-pixel space (matches fixture units)
    startFixture: V2Fixture;
    fixtureCenterCanvas?: { x: number; y: number }; // canvas-pixel center, for 'rotate' only
}

export type Normalized = Required<
    Pick<V2Fixture, 'left' | 'top' | 'width' | 'height'>
>;

export const normalize = (f: V2Fixture): Normalized => ({
    left: f.left ?? 0,
    top: f.top ?? 0,
    width: f.width ?? 100,
    height: f.height ?? 100,
});

export const clamp = (v: number, lo: number, hi: number) =>
    hi < lo ? lo : Math.max(lo, Math.min(hi, v));

export interface Bounds {
    width: number;
    height: number;
}

export function applyDrag(
    fixture: V2Fixture,
    handle: Handle,
    dx: number,
    dy: number,
    bounds: Bounds,
): V2Fixture {
    const start = normalize(fixture);

    // The drag delta arrives as canvas-pixel floats (scale division); round
    // before writing back so the form fields stay in integers.
    if (handle === 'move') {
        const left = Math.round(start.left + dx);
        const top = Math.round(start.top + dy);
        return {
            ...fixture,
            left: clamp(left, 0, bounds.width - start.width),
            top: clamp(top, 0, bounds.height - start.height),
        };
    }

    const rotation = ((fixture as any).rotation ?? 0) as number;
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // Project the canvas-space drag delta into the fixture's local axis space.
    const localDx = dx * cos + dy * sin;
    const localDy = -dx * sin + dy * cos;

    const signX = handle === 'tr' || handle === 'br' ? 1 : -1;
    const signY = handle === 'bl' || handle === 'br' ? 1 : -1;

    const minSize = 10;
    let newW = Math.max(minSize, start.width + signX * localDx);
    let newH = Math.max(minSize, start.height + signY * localDy);

    if (rotation === 0) {
        // Axis-aligned path: keep the original strict bounds-clamping behaviour.
        let newLeft =
            signX === -1 ? start.left + (start.width - newW) : start.left;
        let newTop =
            signY === -1 ? start.top + (start.height - newH) : start.top;

        if (signX === -1 && newLeft < 0) {
            newW += newLeft;
            newLeft = 0;
        } else if (signX === 1 && newLeft + newW > bounds.width) {
            newW = bounds.width - newLeft;
        }
        if (signY === -1 && newTop < 0) {
            newH += newTop;
            newTop = 0;
        } else if (signY === 1 && newTop + newH > bounds.height) {
            newH = bounds.height - newTop;
        }

        newW = Math.max(minSize, newW);
        newH = Math.max(minSize, newH);
        return {
            ...fixture,
            left: Math.round(newLeft),
            top: Math.round(newTop),
            width: Math.round(newW),
            height: Math.round(newH),
        };
    }

    // Rotated path: compute the anchor corner position in canvas space before
    // the drag and back-solve left/top so it stays fixed after the resize.
    const cx0 = start.left + start.width / 2;
    const cy0 = start.top + start.height / 2;
    const anchorLocalX = -signX * (start.width / 2);
    const anchorLocalY = -signY * (start.height / 2);
    const anchorCanvasX = cx0 + anchorLocalX * cos - anchorLocalY * sin;
    const anchorCanvasY = cy0 + anchorLocalX * sin + anchorLocalY * cos;

    const newAnchorLocalX = -signX * (newW / 2);
    const newAnchorLocalY = -signY * (newH / 2);
    const cx1 = anchorCanvasX - newAnchorLocalX * cos + newAnchorLocalY * sin;
    const cy1 = anchorCanvasY - newAnchorLocalX * sin - newAnchorLocalY * cos;

    return {
        ...fixture,
        left: Math.round(cx1 - newW / 2),
        top: Math.round(cy1 - newH / 2),
        width: Math.round(newW),
        height: Math.round(newH),
    };
}
