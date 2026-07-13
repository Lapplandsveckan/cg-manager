import type {
    EdgeBlendInsets,
    NormRect,
    Perspective,
} from '../GeometryHandles';

const IDENTITY_RECT: NormRect = { x: 0, y: 0, w: 1, h: 1 };
const IDENTITY_QUAD: Perspective = {
    tl: { x: 0, y: 0 },
    tr: { x: 1, y: 0 },
    br: { x: 1, y: 1 },
    bl: { x: 0, y: 1 },
};
const ZERO_INSETS: EdgeBlendInsets = { left: 0, right: 0, top: 0, bottom: 0 };

export function rectFromArr(
    arr: number[] | undefined,
    offset: number,
    fallback: NormRect,
): NormRect {
    if (!arr || arr.length < offset + 4) return { ...fallback };
    const [x1, y1, x2, y2] = arr.slice(offset, offset + 4);
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export function arrFromRect(r: NormRect): number[] {
    return [r.x, r.y, r.x + r.w, r.y + r.h];
}

export function quadFromArr(arr: number[] | undefined): Perspective {
    if (!arr || arr.length < 8) return { ...IDENTITY_QUAD };
    return {
        tl: { x: arr[0], y: arr[1] },
        tr: { x: arr[2], y: arr[3] },
        br: { x: arr[4], y: arr[5] },
        bl: { x: arr[6], y: arr[7] },
    };
}

export function arrFromQuad(q: Perspective): number[] {
    return [q.tl.x, q.tl.y, q.tr.x, q.tr.y, q.br.x, q.br.y, q.bl.x, q.bl.y];
}

export function insetsFromArr(arr: number[] | undefined): EdgeBlendInsets {
    if (!arr || arr.length < 4) return { ...ZERO_INSETS };
    return { left: arr[0], right: arr[1], top: arr[2], bottom: arr[3] };
}

export function isIdentityRect(r: NormRect): boolean {
    return r.x === 0 && r.y === 0 && r.w === 1 && r.h === 1;
}

export function isIdentityQuad(q: Perspective): boolean {
    return (
        q.tl.x === 0 &&
        q.tl.y === 0 &&
        q.tr.x === 1 &&
        q.tr.y === 0 &&
        q.br.x === 1 &&
        q.br.y === 1 &&
        q.bl.x === 0 &&
        q.bl.y === 1
    );
}

export function isZeroInsets(i: EdgeBlendInsets): boolean {
    return i.left === 0 && i.right === 0 && i.top === 0 && i.bottom === 0;
}

export const GEOMETRY_IDENTITY = {
    RECT: IDENTITY_RECT,
    QUAD: IDENTITY_QUAD,
    INSETS: ZERO_INSETS,
};
