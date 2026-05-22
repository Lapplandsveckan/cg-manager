import React, {useLayoutEffect, useRef, useState} from 'react';
import {Box, Stack, Typography} from '@mui/material';
import {ChannelPreview} from '../ChannelPreview';

interface GeometryStageProps {
    canvasWidth: number;
    canvasHeight: number;
    /** Render-prop for the overlay layer. `scale` converts normalized 0..1 to
     *  on-screen pixels. Stage size in pixels is also passed so handle layers
     *  can place absolute-positioned children directly. */
    children: (ctx: {scale: number; width: number; height: number}) => React.ReactNode;
    /** When set, stream this 1-based CG channel as the stage backdrop in
     *  place of the dark gradient. The handles overlay on top. */
    previewChannel?: number | null;
}

/** Aspect-correct stage canvas that sizes itself to the parent's width up to
 *  a sensible cap. Used by the geometry editor to host position / perspective
 *  / edge-blend handles on a backdrop matched to the destination channel's
 *  output resolution. */
export const GeometryStage: React.FC<GeometryStageProps> = ({
    canvasWidth, canvasHeight, children, previewChannel,
}) => {
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const [scale, setScale] = useState(1);

    useLayoutEffect(() => {
        const el = wrapperRef.current;
        if (!el) return;
        const recompute = () => {
            const available = el.clientWidth;
            const max = Math.min(available, 960);
            setScale(max / canvasWidth);
        };
        recompute();
        const ro = new ResizeObserver(recompute);
        ro.observe(el);
        return () => ro.disconnect();
    }, [canvasWidth]);

    const width = canvasWidth * scale;
    const height = canvasHeight * scale;

    return (
        <Stack spacing={1} ref={wrapperRef} sx={{minWidth: 0, flex: 1}}>
            <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="baseline"
                sx={{color: 'text.secondary'}}
            >
                <Typography variant="caption" sx={{fontFamily: 'monospace'}}>
                    Stage · {canvasWidth}×{canvasHeight} px
                </Typography>
                <Typography variant="caption" sx={{fontFamily: 'monospace'}}>
                    {Math.round(scale * 100)}%
                </Typography>
            </Stack>
            <Box
                sx={(theme) => ({
                    position: 'relative',
                    width,
                    height,
                    bgcolor: '#1a1d22',
                    backgroundImage:
                        'radial-gradient(ellipse at center, rgba(255,255,255,0.04), transparent 70%)',
                    border: `1px solid ${theme.palette.divider}`,
                    boxShadow: 'inset 0 0 24px rgba(0,0,0,0.45)',
                    overflow: 'hidden',
                    flexShrink: 0,
                })}
            >
                {previewChannel != null && <ChannelPreview channel={previewChannel} objectFit="cover" />}
                {/* Subtle quarter/half guides so the user has something to
                    align against without competing with the handles. */}
                <Box
                    component="svg"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    sx={{position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none'}}
                >
                    {[25, 50, 75].map((p) => (
                        <line
                            key={`v${p}`}
                            x1={p} x2={p} y1={0} y2={100}
                            stroke="rgba(255,255,255,0.05)"
                            strokeWidth={1}
                            vectorEffect="non-scaling-stroke"
                        />
                    ))}
                    {[25, 50, 75].map((p) => (
                        <line
                            key={`h${p}`}
                            x1={0} x2={100} y1={p} y2={p}
                            stroke="rgba(255,255,255,0.05)"
                            strokeWidth={1}
                            vectorEffect="non-scaling-stroke"
                        />
                    ))}
                </Box>
                {children({scale, width, height})}
            </Box>
        </Stack>
    );
};
