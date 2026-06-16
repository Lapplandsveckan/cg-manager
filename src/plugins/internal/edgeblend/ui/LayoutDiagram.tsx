import React, { useLayoutEffect, useRef, useState } from 'react';
import {
    Box,
    FormControlLabel,
    Stack,
    Switch,
    Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ChannelPreview } from '@web-lib';
import { overlapFractions, projectorRects } from '../geometry';

// Brand colours (must not use alpha() — that's not guaranteed in plugin bundles).
// Hex opacity: 24 ≈ 14%, 38 ≈ 22%, 80 ≈ 50%, cc ≈ 80%.
const COPPER = '#c98049';
const COPPER_FILL = `${COPPER}24`;
const COPPER_FILL_ACTIVE = `${COPPER}38`;
const COPPER_BORDER = `${COPPER}80`;
const BLUE_FILL = '#5e8fa126'; // secondary steel-blue at ~15% opacity

const CAP_PX = 720;

interface Props {
    canvasW: number;
    canvasH: number;
    projectorW: number;
    projectorH: number;
    cols: number;
    rows: number;
    outputChannels: number[];
    showPreview: boolean;
    onTogglePreview: () => void;
    previewChannel: number;
    focusedOutput: number | null;
    onFocusOutput: (index: number | null) => void;
}

const LayoutDiagram: React.FC<Props> = ({
    canvasW,
    canvasH,
    projectorW,
    projectorH,
    cols,
    rows,
    outputChannels,
    showPreview,
    onTogglePreview,
    previewChannel,
    focusedOutput,
    onFocusOutput,
}) => {
    const { t } = useTranslation();
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const [scale, setScale] = useState(1);

    useLayoutEffect(() => {
        const el = wrapperRef.current;
        if (!el) return;
        const recompute = () => {
            const max = Math.min(el.clientWidth, CAP_PX);
            setScale(canvasW > 0 ? max / canvasW : 1);
        };
        recompute();
        const ro = new ResizeObserver(recompute);
        ro.observe(el);
        return () => ro.disconnect();
    }, [canvasW]);

    const stageW = canvasW * scale;
    const stageH = canvasH * scale;

    const valid =
        canvasW > 0 &&
        canvasH > 0 &&
        projectorW > 0 &&
        projectorH > 0 &&
        cols >= 1 &&
        rows >= 1;

    const [overlapX, overlapY] = valid
        ? overlapFractions(
              [canvasW, canvasH],
              [projectorW, projectorH],
              [cols, rows],
          )
        : [0, 0];

    const rects = valid
        ? projectorRects(
              [canvasW, canvasH],
              [projectorW, projectorH],
              [cols, rows],
          )
        : [];

    const stepX = projectorW * (1 - overlapX);
    const stepY = projectorH * (1 - overlapY);

    // Horizontal overlap bands (between adjacent columns, spanning all rows).
    const hBands =
        overlapX > 0
            ? Array.from({ length: cols - 1 }, (_, c) => ({
                  x: (c + 1) * stepX,
                  y: 0,
                  w: projectorW * overlapX,
                  h: (rows - 1) * stepY + projectorH,
              }))
            : [];

    // Vertical overlap bands (between adjacent rows, spanning all columns).
    const vBands =
        overlapY > 0
            ? Array.from({ length: rows - 1 }, (_, r) => ({
                  x: 0,
                  y: (r + 1) * stepY,
                  w: (cols - 1) * stepX + projectorW,
                  h: projectorH * overlapY,
              }))
            : [];

    return (
        <Stack spacing={1} ref={wrapperRef} sx={{ flex: 1, minWidth: 0 }}>
            <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
            >
                <Typography
                    variant="caption"
                    sx={{ fontFamily: 'monospace', color: 'text.secondary' }}
                >
                    {canvasW}×{canvasH} · {Math.round(scale * 100)}%
                </Typography>
                <FormControlLabel
                    control={
                        <Switch
                            size="small"
                            checked={showPreview}
                            onChange={onTogglePreview}
                        />
                    }
                    label={
                        <Typography variant="caption">
                            {t('plugins.edgeblend.showPreview')}
                        </Typography>
                    }
                    labelPlacement="start"
                    sx={{ m: 0 }}
                />
            </Stack>

            <Box
                sx={theme => ({
                    position: 'relative',
                    width: stageW,
                    height: stageH,
                    bgcolor: '#1a1d22',
                    backgroundImage:
                        'radial-gradient(ellipse at center, rgba(255,255,255,0.04), transparent 70%)',
                    border: `1px solid ${theme.palette.divider}`,
                    boxShadow: 'inset 0 0 24px rgba(0,0,0,0.45)',
                    overflow: 'hidden',
                    flexShrink: 0,
                })}
            >
                {showPreview && <ChannelPreview channel={previewChannel} />}

                {/* Subtle grid guides */}
                <Box
                    component="svg"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        pointerEvents: 'none',
                    }}
                >
                    {[25, 50, 75].map(p => (
                        <line
                            key={`v${p}`}
                            x1={p}
                            x2={p}
                            y1={0}
                            y2={100}
                            stroke="rgba(255,255,255,0.04)"
                            strokeWidth={1}
                            vectorEffect="non-scaling-stroke"
                        />
                    ))}
                    {[25, 50, 75].map(p => (
                        <line
                            key={`h${p}`}
                            x1={0}
                            x2={100}
                            y1={p}
                            y2={p}
                            stroke="rgba(255,255,255,0.04)"
                            strokeWidth={1}
                            vectorEffect="non-scaling-stroke"
                        />
                    ))}
                </Box>

                {/* Overlap zones */}
                {[...hBands, ...vBands].map((band, bi) => (
                    <Box
                        key={bi}
                        sx={{
                            position: 'absolute',
                            left: band.x * scale,
                            top: band.y * scale,
                            width: band.w * scale,
                            height: band.h * scale,
                            bgcolor: BLUE_FILL,
                            pointerEvents: 'none',
                        }}
                    />
                ))}

                {/* Projector rectangles */}
                {rects.map((rect, i) => {
                    const ch = outputChannels[i];
                    const focused = focusedOutput === i;
                    return (
                        <Box
                            key={i}
                            onClick={() => onFocusOutput(focused ? null : i)}
                            sx={{
                                position: 'absolute',
                                left: rect.x * scale,
                                top: rect.y * scale,
                                width: rect.w * scale,
                                height: rect.h * scale,
                                border: '1px solid',
                                borderColor: focused ? COPPER : COPPER_BORDER,
                                bgcolor: focused
                                    ? COPPER_FILL_ACTIVE
                                    : COPPER_FILL,
                                boxSizing: 'border-box',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                '&:hover': {
                                    borderColor: COPPER,
                                    bgcolor: COPPER_FILL_ACTIVE,
                                },
                            }}
                        >
                            {ch != null && (
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: COPPER,
                                        fontFamily: 'monospace',
                                        lineHeight: 1.3,
                                        textAlign: 'center',
                                        pointerEvents: 'none',
                                        userSelect: 'none',
                                    }}
                                >
                                    CH {ch}
                                    <br />
                                    <span
                                        style={{
                                            opacity: 0.65,
                                            fontSize: '0.85em',
                                        }}
                                    >
                                        {t('plugins.edgeblend.projectorPos', {
                                            col: rect.col + 1,
                                            row: rect.row + 1,
                                        })}
                                    </span>
                                </Typography>
                            )}
                        </Box>
                    );
                })}
            </Box>

            {/* Overlap legend */}
            {(hBands.length > 0 || vBands.length > 0) && (
                <Stack direction="row" spacing={1} alignItems="center">
                    <Box
                        sx={{
                            width: 12,
                            height: 12,
                            bgcolor: BLUE_FILL,
                            border: '1px solid #5e8fa180',
                            flexShrink: 0,
                        }}
                    />
                    <Typography
                        variant="caption"
                        sx={{ color: 'text.secondary' }}
                    >
                        {t('plugins.edgeblend.overlapZone')}
                    </Typography>
                </Stack>
            )}
        </Stack>
    );
};

export default LayoutDiagram;
