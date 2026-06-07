import React, { useMemo } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { useTranslation } from 'next-i18next';
import type {
    EdgeBlendInsets,
    Perspective,
    NormRect,
} from '../GeometryHandles';
import { FloatSlider } from './FloatSlider';

type Tabkey = 'position' | 'perspective' | 'edgeblend';

interface TabControlsProps {
    tab: Tabkey;
    srcRect: NormRect;
    destRect: NormRect;
    quad: Perspective;
    insets: EdgeBlendInsets;
    gamma: number;
    power: number;
    alpha: number;
    setGamma: (v: number) => void;
    setPower: (v: number) => void;
    setAlpha: (v: number) => void;
}

const formatRect = (r: NormRect) =>
    `x ${r.x.toFixed(3)}  y ${r.y.toFixed(3)}  w ${r.w.toFixed(3)}  h ${r.h.toFixed(3)}`;

const formatPoint = (p: { x: number; y: number }) =>
    `(${p.x.toFixed(3)}, ${p.y.toFixed(3)})`;

export const TabControls: React.FC<TabControlsProps> = ({
    tab,
    srcRect,
    destRect,
    quad,
    insets,
    gamma,
    power,
    alpha,
    setGamma,
    setPower,
    setAlpha,
}) => {
    const { t } = useTranslation('common');
    const readout = useMemo(() => {
        if (tab === 'position')
            return [
                {
                    label: t('videoRoutes.geometry.readout.destination'),
                    value: formatRect(destRect),
                },
                {
                    label: t('videoRoutes.geometry.readout.source'),
                    value: formatRect(srcRect),
                },
            ];
        if (tab === 'perspective')
            return [
                {
                    label: t('videoRoutes.geometry.readout.topLeft'),
                    value: formatPoint(quad.tl),
                },
                {
                    label: t('videoRoutes.geometry.readout.topRight'),
                    value: formatPoint(quad.tr),
                },
                {
                    label: t('videoRoutes.geometry.readout.bottomRight'),
                    value: formatPoint(quad.br),
                },
                {
                    label: t('videoRoutes.geometry.readout.bottomLeft'),
                    value: formatPoint(quad.bl),
                },
            ];
        return [
            {
                label: t('videoRoutes.geometry.readout.left'),
                value: insets.left.toFixed(3),
            },
            {
                label: t('videoRoutes.geometry.readout.right'),
                value: insets.right.toFixed(3),
            },
            {
                label: t('videoRoutes.geometry.readout.top'),
                value: insets.top.toFixed(3),
            },
            {
                label: t('videoRoutes.geometry.readout.bottom'),
                value: insets.bottom.toFixed(3),
            },
        ];
    }, [tab, srcRect, destRect, quad, insets, t]);

    return (
        <Stack spacing={1.5}>
            {tab === 'perspective' && (
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                    {t('videoRoutes.geometry.perspectiveHint')}
                </Typography>
            )}

            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 1,
                }}
            >
                {readout.map(r => (
                    <Stack key={r.label} spacing={0.25}>
                        <Typography
                            variant="caption"
                            sx={{ color: 'text.disabled' }}
                        >
                            {r.label}
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                fontFamily: 'monospace',
                                color: 'text.secondary',
                            }}
                        >
                            {r.value}
                        </Typography>
                    </Stack>
                ))}
            </Box>

            {tab === 'edgeblend' && (
                <Stack
                    spacing={1.5}
                    sx={theme => ({
                        p: 2,
                        bgcolor: theme.palette.surface.elevated,
                        borderRadius: 1,
                    })}
                >
                    <Typography
                        variant="caption"
                        sx={{ color: 'text.disabled' }}
                    >
                        {t('videoRoutes.geometry.edgeblendHint')}
                    </Typography>
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns:
                                'repeat(auto-fit, minmax(220px, 1fr))',
                            gap: 2,
                        }}
                    >
                        <FloatSlider
                            label={t('videoRoutes.geometry.gamma')}
                            value={gamma}
                            min={0.1}
                            max={5}
                            step={0.05}
                            onChange={setGamma}
                        />
                        <FloatSlider
                            label={t('videoRoutes.geometry.power')}
                            value={power}
                            min={0.1}
                            max={10}
                            step={0.1}
                            onChange={setPower}
                        />
                        <FloatSlider
                            label={t('videoRoutes.geometry.alpha')}
                            value={alpha}
                            min={0}
                            max={1}
                            step={0.01}
                            onChange={setAlpha}
                        />
                    </Box>
                </Stack>
            )}
        </Stack>
    );
};
