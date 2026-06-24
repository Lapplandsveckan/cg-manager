import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { useTranslation } from 'next-i18next';
import { ChannelPreview } from '../../../ChannelPreview';
import { type V2Fixture } from '../types';
import {
    type Handle,
    type DragState,
    normalize,
    applyDrag,
} from './canvasGeometry';
import { FixtureView } from './FixtureView';

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
