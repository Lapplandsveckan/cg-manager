export interface NormRect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface NormPoint {
    x: number;
    y: number;
}

export interface Perspective {
    tl: NormPoint;
    tr: NormPoint;
    br: NormPoint;
    bl: NormPoint;
}

export interface EdgeBlendInsets {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

export const HANDLE_SIZE = 14;
export const PRIMARY = '#c98049';
export const SECONDARY = '#6daedb';

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
