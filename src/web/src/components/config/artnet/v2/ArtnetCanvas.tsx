import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Box, Stack, Typography, alpha } from '@mui/material';
import { useTranslation } from 'next-i18next';
import { ChannelPreview } from '../../../ChannelPreview';
import { type V2Fixture } from '../types';
import { parseCount } from './v2Fixture';

interface ArtnetCanvasProps {
    fixtures: V2Fixture[];
    canvasWidth: number;
    canvasHeight: number;
    selectedIndex: number | null;
    onSelect: (index: number | null) => void;
    onChange: (fixtures: V2Fixture[]) => void;
    /** When set, stream this 1-based CG channel as the stage backdrop in
     *  place of the dark gradient. Fixtures render on top. */
    previewChannel?: number | null;
}

type Handle = 'move' | 'tl' | 'tr' | 'br' | 'bl' | 'rotate';

interface DragState {
    fixtureIndex: number;
    handle: Handle;
    startMouseCanvas: { x: number; y: number }; // canvas-pixel space (matches fixture units)
    startFixture: V2Fixture;
    fixtureCenterCanvas?: { x: number; y: number }; // canvas-pixel center, for 'rotate' only
}

type Normalized = Required<
    Pick<V2Fixture, 'left' | 'top' | 'width' | 'height'>
>;

const normalize = (f: V2Fixture): Normalized => ({
    left: f.left ?? 0,
    top: f.top ?? 0,
    width: f.width ?? 100,
    height: f.height ?? 100,
});

const clamp = (v: number, lo: number, hi: number) =>
    hi < lo ? lo : Math.max(lo, Math.min(hi, v));

interface Bounds {
    width: number;
    height: number;
}

function applyDrag(
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

const FIXTURE_COLOR = '#c98049';
const HANDLE_SIZE = 14;
/** Gap (px, DOM) between the box top edge and the bottom of the rotate handle. */
const ROTATE_HANDLE_GAP = 18;

interface FixtureViewProps {
    fixture: V2Fixture;
    scale: number;
    selected: boolean;
    onPointerDownHandle: (e: React.PointerEvent, handle: Handle) => void;
    onClick: () => void;
}

const FixtureGrid: React.FC<{ w: number; h: number }> = ({ w, h }) => {
    if (w <= 1 && h <= 1) return null;
    return (
        <Box
            component="svg"
            viewBox={`0 0 ${w} ${h}`}
            preserveAspectRatio="none"
            sx={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
            }}
        >
            {Array.from({ length: w - 1 }, (_, i) => (
                <line
                    key={`v${i}`}
                    x1={i + 1}
                    x2={i + 1}
                    y1={0}
                    y2={h}
                    stroke={FIXTURE_COLOR}
                    strokeOpacity={0.55}
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                />
            ))}
            {Array.from({ length: h - 1 }, (_, i) => (
                <line
                    key={`h${i}`}
                    x1={0}
                    x2={w}
                    y1={i + 1}
                    y2={i + 1}
                    stroke={FIXTURE_COLOR}
                    strokeOpacity={0.55}
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                />
            ))}
        </Box>
    );
};

const FixtureView: React.FC<FixtureViewProps> = ({
    fixture,
    scale,
    selected,
    onPointerDownHandle,
    onClick,
}) => {
    const f = normalize(fixture);
    const { w, h } = parseCount(fixture.fixtureCount);
    const count = fixture.fixtureCount ? ` × ${fixture.fixtureCount}` : '';
    const label = `${fixture.type ?? '—'}${count}`;

    const rotation = (fixture as any).rotation ?? 0;
    const mirrorX = (fixture as any).mirrorX ?? false;
    const mirrorY = (fixture as any).mirrorY ?? false;

    // Mirror is applied to the inner grid layer only — it affects the pixel
    // sampling direction, not the physical position of the fixture on stage.
    const mirrorTransform = [
        mirrorX ? 'scaleX(-1)' : '',
        mirrorY ? 'scaleY(-1)' : '',
    ]
        .filter(Boolean)
        .join(' ');

    const handleStyle = (corner: Handle): React.CSSProperties => {
        const isLeft = corner === 'tl' || corner === 'bl';
        const isTop = corner === 'tl' || corner === 'tr';
        return {
            position: 'absolute',
            width: HANDLE_SIZE,
            height: HANDLE_SIZE,
            borderRadius: 3,
            background: '#fff',
            border: `1.5px solid ${FIXTURE_COLOR}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
            left: isLeft ? -HANDLE_SIZE / 2 : undefined,
            right: isLeft ? undefined : -HANDLE_SIZE / 2,
            top: isTop ? -HANDLE_SIZE / 2 : undefined,
            bottom: isTop ? undefined : -HANDLE_SIZE / 2,
            cursor:
                corner === 'tl' || corner === 'br'
                    ? 'nwse-resize'
                    : 'nesw-resize',
            zIndex: 2,
        };
    };

    return (
        <Box
            sx={{
                position: 'absolute',
                left: f.left * scale,
                top: f.top * scale,
                width: f.width * scale,
                height: f.height * scale,
                // Rotation is on the outer box so the whole fixture visually
                // rotates on the stage, including its handles and badges.
                transform: rotation ? `rotate(${rotation}deg)` : undefined,
                outline: selected
                    ? `2px solid ${FIXTURE_COLOR}`
                    : `1px solid ${alpha(FIXTURE_COLOR, 0.55)}`,
                background: alpha(FIXTURE_COLOR, selected ? 0.22 : 0.14),
                cursor: 'move',
                userSelect: 'none',
                touchAction: 'none',
                // overflow: visible so the rotate handle and badges can extend
                // outside the box bounds (clipped by the stage instead).
                overflow: 'visible',
                zIndex: selected ? 10 : undefined,
            }}
            onPointerDown={e => {
                e.stopPropagation();
                onClick();
                onPointerDownHandle(e, 'move');
            }}
        >
            {/* Inner layer — mirror-only transform; grid stays inside the box */}
            <Box
                sx={{
                    position: 'absolute',
                    inset: 0,
                    transform: mirrorTransform || undefined,
                    pointerEvents: 'none',
                    overflow: 'hidden',
                }}
            >
                <FixtureGrid w={w} h={h} />
            </Box>

            <Box
                sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                    fontFamily: 'monospace',
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#fff',
                    textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    zIndex: 1,
                }}
            >
                {label}
            </Box>

            {/* Badges — sit above the top edge, rotate with the fixture */}
            {(rotation !== 0 || mirrorX || mirrorY) && (
                <Box
                    sx={{
                        position: 'absolute',
                        bottom: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        mb: '4px',
                        display: 'flex',
                        gap: 0.5,
                        alignItems: 'center',
                        pointerEvents: 'none',
                        bgcolor: 'rgba(0,0,0,0.6)',
                        borderRadius: 0.5,
                        px: 0.75,
                        py: 0.25,
                        whiteSpace: 'nowrap',
                        zIndex: 3,
                    }}
                >
                    {rotation !== 0 && (
                        <Box
                            component="span"
                            sx={{
                                fontFamily: 'monospace',
                                fontSize: 12,
                                color: FIXTURE_COLOR,
                                lineHeight: 1,
                            }}
                        >
                            {rotation}°
                        </Box>
                    )}
                    {mirrorX && (
                        <Box
                            component="span"
                            sx={{
                                fontFamily: 'monospace',
                                fontSize: 12,
                                color: FIXTURE_COLOR,
                                lineHeight: 1,
                            }}
                        >
                            ↔
                        </Box>
                    )}
                    {mirrorY && (
                        <Box
                            component="span"
                            sx={{
                                fontFamily: 'monospace',
                                fontSize: 12,
                                color: FIXTURE_COLOR,
                                lineHeight: 1,
                            }}
                        >
                            ↕
                        </Box>
                    )}
                </Box>
            )}

            {/* Corner resize handles */}
            {selected &&
                (['tl', 'tr', 'br', 'bl'] as Handle[]).map(corner => (
                    <Box
                        key={corner}
                        sx={handleStyle(corner)}
                        onPointerDown={e => {
                            e.stopPropagation();
                            onPointerDownHandle(e, corner);
                        }}
                    />
                ))}

            {/* Rotate handle — circle above top-center, connected by a thin line */}
            {selected && (
                <>
                    {/* Connector line */}
                    <Box
                        sx={{
                            position: 'absolute',
                            left: '50%',
                            top: -ROTATE_HANDLE_GAP,
                            width: '1px',
                            height: ROTATE_HANDLE_GAP,
                            bgcolor: alpha(FIXTURE_COLOR, 0.5),
                            pointerEvents: 'none',
                            zIndex: 2,
                        }}
                    />
                    {/* Circle handle */}
                    <Box
                        sx={{
                            position: 'absolute',
                            left: `calc(50% - ${HANDLE_SIZE / 2}px)`,
                            top: -(ROTATE_HANDLE_GAP + HANDLE_SIZE),
                            width: HANDLE_SIZE,
                            height: HANDLE_SIZE,
                            borderRadius: '50%',
                            background: '#fff',
                            border: `1.5px solid ${FIXTURE_COLOR}`,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                            cursor: 'crosshair',
                            zIndex: 2,
                        }}
                        onPointerDown={e => {
                            e.stopPropagation();
                            onPointerDownHandle(e, 'rotate');
                        }}
                    />
                </>
            )}
        </Box>
    );
};

export const ArtnetCanvas: React.FC<ArtnetCanvasProps> = ({
    fixtures,
    canvasWidth,
    canvasHeight,
    selectedIndex,
    onSelect,
    onChange,
    previewChannel,
}) => {
    const { t } = useTranslation('common');
    const stageRef = useRef<HTMLDivElement | null>(null);
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const [scale, setScale] = useState(1);
    const dragRef = useRef<DragState | null>(null);

    // Fit-to-width: keep the stage at the channel's aspect ratio, scaled to
    // whatever width the modal gives us.
    useLayoutEffect(() => {
        const el = wrapperRef.current;
        if (!el) return;
        const recompute = () => {
            const available = el.clientWidth;
            const max = Math.min(available, 720);
            setScale(max / canvasWidth);
        };
        recompute();
        const ro = new ResizeObserver(recompute);
        ro.observe(el);
        return () => ro.disconnect();
    }, [canvasWidth]);

    const toCanvas = (clientX: number, clientY: number) => {
        const rect = stageRef.current!.getBoundingClientRect();
        return {
            x: (clientX - rect.left) / scale,
            y: (clientY - rect.top) / scale,
        };
    };

    const handlePointerDown = (
        e: React.PointerEvent,
        index: number,
        handle: Handle,
    ) => {
        const target = e.currentTarget as HTMLElement;
        target.setPointerCapture(e.pointerId);
        const f = normalize(fixtures[index]);
        const fixtureCenterCanvas =
            handle === 'rotate'
                ? { x: f.left + f.width / 2, y: f.top + f.height / 2 }
                : undefined;
        dragRef.current = {
            fixtureIndex: index,
            handle,
            startMouseCanvas: toCanvas(e.clientX, e.clientY),
            startFixture: { ...fixtures[index] },
            fixtureCenterCanvas,
        };
    };

    useEffect(() => {
        const onMove = (e: PointerEvent) => {
            const state = dragRef.current;
            if (!state) return;
            const mouse = toCanvas(e.clientX, e.clientY);

            if (state.handle === 'rotate') {
                const { x: cx, y: cy } = state.fixtureCenterCanvas!;
                const startAngle = Math.atan2(
                    state.startMouseCanvas.y - cy,
                    state.startMouseCanvas.x - cx,
                );
                const curAngle = Math.atan2(mouse.y - cy, mouse.x - cx);
                const deltaDeg = (curAngle - startAngle) * (180 / Math.PI);
                const raw = (state.startFixture.rotation ?? 0) + deltaDeg;
                const newRotation = ((Math.round(raw) % 360) + 360) % 360;
                onChange(
                    fixtures.map((f, i) =>
                        i === state.fixtureIndex
                            ? { ...f, rotation: newRotation }
                            : f,
                    ),
                );
                return;
            }

            const dx = mouse.x - state.startMouseCanvas.x;
            const dy = mouse.y - state.startMouseCanvas.y;
            const updated = applyDrag(
                state.startFixture,
                state.handle,
                dx,
                dy,
                {
                    width: canvasWidth,
                    height: canvasHeight,
                },
            );
            onChange(
                fixtures.map((f, i) =>
                    i === state.fixtureIndex ? updated : f,
                ),
            );
        };
        const onUp = () => {
            dragRef.current = null;
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
        };
    }, [fixtures, onChange, scale, canvasWidth, canvasHeight]);

    return (
        <Stack spacing={1} ref={wrapperRef} sx={{ minWidth: 0, flex: 1 }}>
            <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="baseline"
                sx={{ color: 'text.secondary' }}
            >
                <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                    {t('config.artnet.canvas.stage', {
                        width: canvasWidth,
                        height: canvasHeight,
                    })}
                </Typography>
                <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                    {Math.round(scale * 100)}%
                </Typography>
            </Stack>
            <Box
                ref={stageRef}
                onPointerDown={() => onSelect(null)}
                sx={theme => ({
                    position: 'relative',
                    width: canvasWidth * scale,
                    height: canvasHeight * scale,
                    // Slightly warm dark with a centered vignette — gives depth
                    // and stage feel without lines that fight the fixture grid.
                    bgcolor: '#1a1d22',
                    backgroundImage:
                        'radial-gradient(ellipse at center, rgba(255,255,255,0.04), transparent 70%)',
                    border: `1px solid ${theme.palette.divider}`,
                    boxShadow: 'inset 0 0 24px rgba(0,0,0,0.45)',
                    overflow: 'hidden',
                    flexShrink: 0,
                })}
            >
                {previewChannel != null && (
                    <ChannelPreview
                        channel={previewChannel}
                        objectFit="cover"
                    />
                )}
                {fixtures.map((fixture, i) => (
                    <FixtureView
                        key={i}
                        fixture={fixture}
                        scale={scale}
                        selected={i === selectedIndex}
                        onPointerDownHandle={(e, handle) =>
                            handlePointerDown(e, i, handle)
                        }
                        onClick={() => onSelect(i)}
                    />
                ))}
            </Box>
        </Stack>
    );
};
