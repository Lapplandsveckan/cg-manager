import React, {useEffect, useRef} from 'react';
import {Box} from '@mui/material';

const HANDLE_SIZE = 14;
const PRIMARY = '#c98049';
const SECONDARY = '#6daedb';

export interface NormRect { x: number; y: number; w: number; h: number }
export interface NormPoint { x: number; y: number }
export interface Perspective { tl: NormPoint; tr: NormPoint; br: NormPoint; bl: NormPoint }
export interface EdgeBlendInsets { left: number; right: number; top: number; bottom: number }

type RectHandle = 'move' | 'tl' | 'tr' | 'br' | 'bl';
type CornerKey = keyof Perspective;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

interface PointerCaptureProps {
    onMove: (clientX: number, clientY: number) => void;
}

/** Shared global-listener hook for drag tracking. Components register an
 *  onMove handler and a ref-stored "active" flag; the hook wires up window
 *  pointermove/up/cancel listeners that read from the ref. */
function useGlobalDrag({onMove}: PointerCaptureProps) {
    const activeRef = useRef(false);

    useEffect(() => {
        const move = (e: PointerEvent) => { if (activeRef.current) onMove(e.clientX, e.clientY); };
        const up = () => { activeRef.current = false; };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', up);
        return () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            window.removeEventListener('pointercancel', up);
        };
    }, [onMove]);

    return {
        begin: (e: React.PointerEvent) => {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            activeRef.current = true;
        },
    };
}

/** Convert a clientX/clientY pair to normalized 0..1 stage coordinates,
 *  using the stage element's bounding rect for the active scale. */
function toNorm(stage: HTMLElement, clientX: number, clientY: number): NormPoint {
    const rect = stage.getBoundingClientRect();
    return {
        x: rect.width === 0 ? 0 : (clientX - rect.left) / rect.width,
        y: rect.height === 0 ? 0 : (clientY - rect.top) / rect.height,
    };
}

const handleBoxStyle = (corner: RectHandle, color: string): React.CSSProperties => {
    const isLeft = corner === 'tl' || corner === 'bl';
    const isTop = corner === 'tl' || corner === 'tr';
    return {
        position: 'absolute',
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
        borderRadius: 3,
        background: '#fff',
        border: `1.5px solid ${color}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
        left: isLeft ? -HANDLE_SIZE / 2 : undefined,
        right: isLeft ? undefined : -HANDLE_SIZE / 2,
        top: isTop ? -HANDLE_SIZE / 2 : undefined,
        bottom: isTop ? undefined : -HANDLE_SIZE / 2,
        cursor: corner === 'tl' || corner === 'br' ? 'nwse-resize' : 'nesw-resize',
        zIndex: 2,
    };
};

interface RectHandlesProps {
    rect: NormRect;
    onChange: (rect: NormRect) => void;
    color?: string;
    label?: string;
    width: number;
    height: number;
    stageRef: React.RefObject<HTMLElement | null>;
}

/** Draggable rectangle in normalized 0..1 stage coords. Used for the
 *  transform destination FILL and for the edge-blend region. */
export const RectHandles: React.FC<RectHandlesProps> = (props) => {
    const {rect, onChange, color = PRIMARY, label, width, height, stageRef} = props;
    const stateRef = useRef<{handle: RectHandle; start: NormPoint; startRect: NormRect} | null>(null);

    const drag = useGlobalDrag({
        onMove: (clientX, clientY) => {
            const stage = stageRef.current;
            const state = stateRef.current;
            if (!stage || !state) return;
            const now = toNorm(stage, clientX, clientY);
            const dx = now.x - state.start.x;
            const dy = now.y - state.start.y;
            onChange(applyRectDrag(state.startRect, state.handle, dx, dy));
        },
    });

    const begin = (e: React.PointerEvent, handle: RectHandle) => {
        const stage = stageRef.current;
        if (!stage) return;
        e.stopPropagation();
        drag.begin(e);
        stateRef.current = {
            handle,
            start: toNorm(stage, e.clientX, e.clientY),
            startRect: {...rect},
        };
    };

    return (
        <Box
            sx={{
                position: 'absolute',
                left: rect.x * width,
                top: rect.y * height,
                width: rect.w * width,
                height: rect.h * height,
                outline: `2px solid ${color}`,
                background: `${color}22`,
                cursor: 'move',
                touchAction: 'none',
                userSelect: 'none',
            }}
            onPointerDown={(e) => begin(e, 'move')}
        >
            {label && (
                <Box
                    sx={{
                        position: 'absolute',
                        top: 6,
                        left: 6,
                        fontFamily: 'monospace',
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#fff',
                        textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                        pointerEvents: 'none',
                    }}
                >
                    {label}
                </Box>
            )}
            {(['tl', 'tr', 'br', 'bl'] as RectHandle[]).map((corner) => (
                <Box
                    key={corner}
                    sx={handleBoxStyle(corner, color)}
                    onPointerDown={(e) => begin(e, corner)}
                />
            ))}
        </Box>
    );
};

function applyRectDrag(start: NormRect, handle: RectHandle, dx: number, dy: number): NormRect {
    if (handle === 'move') {
        const x = clamp01(start.x + dx);
        const y = clamp01(start.y + dy);
        return {
            x: Math.min(x, 1 - start.w),
            y: Math.min(y, 1 - start.h),
            w: start.w,
            h: start.h,
        };
    }

    const signX = handle === 'tr' || handle === 'br' ? 1 : -1;
    const signY = handle === 'bl' || handle === 'br' ? 1 : -1;
    const minSize = 0.02;

    let newW = Math.max(minSize, start.w + signX * dx);
    let newH = Math.max(minSize, start.h + signY * dy);
    let newX = signX === -1 ? start.x + (start.w - newW) : start.x;
    let newY = signY === -1 ? start.y + (start.h - newH) : start.y;

    if (signX === -1 && newX < 0) { newW += newX; newX = 0; }
    else if (signX === 1 && newX + newW > 1) newW = 1 - newX;

    if (signY === -1 && newY < 0) { newH += newY; newY = 0; }
    else if (signY === 1 && newY + newH > 1) newH = 1 - newY;

    return {
        x: newX,
        y: newY,
        w: Math.max(minSize, newW),
        h: Math.max(minSize, newH),
    };
}

interface PerspectiveHandlesProps {
    quad: Perspective;
    onChange: (quad: Perspective) => void;
    width: number;
    height: number;
    stageRef: React.RefObject<HTMLElement | null>;
}

export const PerspectiveHandles: React.FC<PerspectiveHandlesProps> = ({quad, onChange, width, height, stageRef}) => {
    const stateRef = useRef<{corner: CornerKey} | null>(null);

    const drag = useGlobalDrag({
        onMove: (clientX, clientY) => {
            const stage = stageRef.current;
            const state = stateRef.current;
            if (!stage || !state) return;
            const p = toNorm(stage, clientX, clientY);
            // CasparCG accepts perspective corners outside [0,1] for "stretch
            // beyond stage" warps, but for an interactive UI we keep them on
            // the stage to avoid the user dragging a point to (-9, 0) by
            // mistake.
            onChange({...quad, [state.corner]: {x: clamp01(p.x), y: clamp01(p.y)}});
        },
    });

    const begin = (e: React.PointerEvent, corner: CornerKey) => {
        e.stopPropagation();
        drag.begin(e);
        stateRef.current = {corner};
    };

    const corners: {key: CornerKey; cursor: string}[] = [
        {key: 'tl', cursor: 'nwse-resize'},
        {key: 'tr', cursor: 'nesw-resize'},
        {key: 'br', cursor: 'nwse-resize'},
        {key: 'bl', cursor: 'nesw-resize'},
    ];

    return (
        <>
            <Box
                component="svg"
                viewBox={`0 0 ${width} ${height}`}
                sx={{position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none'}}
            >
                <polygon
                    points={[quad.tl, quad.tr, quad.br, quad.bl]
                        .map((p) => `${p.x * width},${p.y * height}`)
                        .join(' ')}
                    fill={`${SECONDARY}22`}
                    stroke={SECONDARY}
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                />
            </Box>
            {corners.map(({key, cursor}) => {
                const p = quad[key];
                return (
                    <Box
                        key={key}
                        sx={{
                            position: 'absolute',
                            left: p.x * width - HANDLE_SIZE / 2,
                            top: p.y * height - HANDLE_SIZE / 2,
                            width: HANDLE_SIZE,
                            height: HANDLE_SIZE,
                            borderRadius: '50%',
                            background: '#fff',
                            border: `2px solid ${SECONDARY}`,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
                            cursor,
                            touchAction: 'none',
                            zIndex: 3,
                        }}
                        onPointerDown={(e) => begin(e, key)}
                    />
                );
            })}
        </>
    );
};

type Edge = 'left' | 'right' | 'top' | 'bottom';

interface EdgeBlendHandlesProps {
    insets: EdgeBlendInsets;
    onChange: (next: EdgeBlendInsets) => void;
    width: number;
    height: number;
    stageRef: React.RefObject<HTMLElement | null>;
}

/** Draggable edge-inset handles for MIXER EDGEBLEND. Each edge has a handle
 *  sitting on the inner boundary of its blend band; dragging the handle
 *  toward the centre grows the blend, dragging it back to the screen edge
 *  removes it. Range is clamped per-edge so left+right (and top+bottom)
 *  can never overlap. */
export const EdgeBlendHandles: React.FC<EdgeBlendHandlesProps> = (props) => {
    const {insets, onChange, width, height, stageRef} = props;
    const stateRef = useRef<{edge: Edge; start: NormPoint; startInsets: EdgeBlendInsets} | null>(null);

    const drag = useGlobalDrag({
        onMove: (clientX, clientY) => {
            const stage = stageRef.current;
            const state = stateRef.current;
            if (!stage || !state) return;
            const now = toNorm(stage, clientX, clientY);
            const dx = now.x - state.start.x;
            const dy = now.y - state.start.y;
            const max = 0.5;
            const s = state.startInsets;
            const next = {...s};
            const clamp = (v: number, lim: number) => Math.max(0, Math.min(max, Math.min(lim, v)));
            if (state.edge === 'left')   next.left   = clamp(s.left + dx,   1 - s.right);
            if (state.edge === 'right')  next.right  = clamp(s.right - dx,  1 - s.left);
            if (state.edge === 'top')    next.top    = clamp(s.top + dy,    1 - s.bottom);
            if (state.edge === 'bottom') next.bottom = clamp(s.bottom - dy, 1 - s.top);
            onChange(next);
        },
    });

    const begin = (e: React.PointerEvent, edge: Edge) => {
        const stage = stageRef.current;
        if (!stage) return;
        e.stopPropagation();
        drag.begin(e);
        stateRef.current = {
            edge,
            start: toNorm(stage, e.clientX, e.clientY),
            startInsets: {...insets},
        };
    };

    const bands: {edge: Edge; style: React.CSSProperties; grad: string; hasWidth: boolean}[] = [
        {
            edge: 'left',
            style: {left: 0, top: 0, width: insets.left * width, height},
            grad: `linear-gradient(to right, ${SECONDARY}55, ${SECONDARY}00)`,
            hasWidth: insets.left > 0,
        },
        {
            edge: 'right',
            style: {right: 0, top: 0, width: insets.right * width, height},
            grad: `linear-gradient(to left, ${SECONDARY}55, ${SECONDARY}00)`,
            hasWidth: insets.right > 0,
        },
        {
            edge: 'top',
            style: {left: 0, top: 0, width, height: insets.top * height},
            grad: `linear-gradient(to bottom, ${SECONDARY}55, ${SECONDARY}00)`,
            hasWidth: insets.top > 0,
        },
        {
            edge: 'bottom',
            style: {left: 0, bottom: 0, width, height: insets.bottom * height},
            grad: `linear-gradient(to top, ${SECONDARY}55, ${SECONDARY}00)`,
            hasWidth: insets.bottom > 0,
        },
    ];

    // Handle positions: midpoint of each edge at the inner boundary of the
    // blend band. When the inset is zero the handle sits flush with the
    // screen edge — still grabbable.
    interface Hp { edge: Edge; left?: number; top?: number; right?: number; bottom?: number; vertical: boolean }
    const handlePositions: Hp[] = [
        {edge: 'left',   left: insets.left * width,    top: height / 2,                vertical: false},
        {edge: 'right',  right: insets.right * width,  top: height / 2,                vertical: false},
        {edge: 'top',    left: width / 2,              top: insets.top * height,       vertical: true},
        {edge: 'bottom', left: width / 2,              bottom: insets.bottom * height, vertical: true},
    ];

    return (
        <>
            {bands.filter((b) => b.hasWidth).map((b) => (
                <Box
                    key={b.edge}
                    sx={{position: 'absolute', ...b.style, background: b.grad, pointerEvents: 'none'}}
                />
            ))}
            {/* Inner-boundary guide lines for the edges that have width. */}
            {insets.left > 0 && (
                <Box sx={{position: 'absolute', left: insets.left * width, top: 0, width: 0, height,
                    borderLeft: `1px dashed ${SECONDARY}88`, pointerEvents: 'none'}} />
            )}
            {insets.right > 0 && (
                <Box sx={{position: 'absolute', right: insets.right * width, top: 0, width: 0, height,
                    borderRight: `1px dashed ${SECONDARY}88`, pointerEvents: 'none'}} />
            )}
            {insets.top > 0 && (
                <Box sx={{position: 'absolute', left: 0, top: insets.top * height, width, height: 0,
                    borderTop: `1px dashed ${SECONDARY}88`, pointerEvents: 'none'}} />
            )}
            {insets.bottom > 0 && (
                <Box sx={{position: 'absolute', left: 0, bottom: insets.bottom * height, width, height: 0,
                    borderBottom: `1px dashed ${SECONDARY}88`, pointerEvents: 'none'}} />
            )}
            {handlePositions.map((p) => (
                <Box
                    key={p.edge}
                    sx={{
                        position: 'absolute',
                        left: p.left !== undefined ? p.left - HANDLE_SIZE / 2 : undefined,
                        right: p.right !== undefined ? p.right - HANDLE_SIZE / 2 : undefined,
                        top: p.top !== undefined ? p.top - HANDLE_SIZE / 2 : undefined,
                        bottom: p.bottom !== undefined ? p.bottom - HANDLE_SIZE / 2 : undefined,
                        width: HANDLE_SIZE,
                        height: HANDLE_SIZE,
                        borderRadius: '50%',
                        background: '#fff',
                        border: `2px solid ${SECONDARY}`,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
                        cursor: p.vertical ? 'ns-resize' : 'ew-resize',
                        touchAction: 'none',
                        zIndex: 4,
                    }}
                    onPointerDown={(e) => begin(e, p.edge)}
                />
            ))}
        </>
    );
};
