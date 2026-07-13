import React from 'react';
import { Box, alpha } from '@mui/material';
import { type V2Fixture } from '../types';
import { type Handle, normalize } from './canvasGeometry';
import { parseCount } from './v2Fixture';

export const FIXTURE_COLOR = '#c98049';
const HANDLE_SIZE = 14;
/** Gap (px, DOM) between the box top edge and the bottom of the rotate handle. */
const ROTATE_HANDLE_GAP = 18;

export interface FixtureViewProps {
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

export const FixtureView: React.FC<FixtureViewProps> = ({
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
