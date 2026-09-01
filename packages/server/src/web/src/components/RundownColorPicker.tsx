import React, { useEffect, useState } from 'react';
import { Box, Button, Stack, Tooltip, Typography } from '@mui/material';
import { MuiColorInput } from 'mui-color-input';
import { useTranslation } from 'react-i18next';

/** Preset accent colors, tuned to stay legible against the dark theme's
 *  `surface.*` ramp. Kept short and curated on purpose — a free color picker
 *  alone tends to produce unreadable or inconsistent rundowns. */
export const RUNDOWN_COLOR_PRESETS = [
    '#c98049', // copper (theme primary)
    '#5e8fa1', // steel blue (theme secondary)
    '#7a9d54', // green
    '#c9574f', // red
    '#a06bd9', // purple
    '#d9b04a', // amber
    '#4fb3bf', // teal
    '#d97fb0', // pink
];

const HEX_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Accepts `#rgb` / `#rrggbb` (case-insensitive), returns `null` otherwise —
 *  the guard between a plugin-supplied `metadata.color` and interpolating it
 *  straight into `sx`. */
export function normalizeRundownColor(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    return HEX_PATTERN.test(value) ? value : null;
}

interface RundownColorPickerProps {
    value?: string | null;
    onChange: (color: string | null) => void;
    label?: string;
}

export const RundownColorPicker: React.FC<RundownColorPickerProps> = ({
    value,
    onChange,
    label,
}) => {
    const { t } = useTranslation('common');
    const normalized = normalizeRundownColor(value);
    const isPreset =
        normalized !== null && RUNDOWN_COLOR_PRESETS.includes(normalized);
    const [customOpen, setCustomOpen] = useState(
        normalized !== null && !isPreset,
    );
    // Local draft so the input can hold partial/invalid text while typing —
    // committing normalizeRundownColor(v) ?? v upward would either fight the
    // field (snapping back to a fallback) or silently persist an invalid
    // value that then renders as no accent at all.
    const [draft, setDraft] = useState(normalized ?? '#ffffff');

    useEffect(() => {
        setDraft(normalized ?? '#ffffff');
    }, [normalized]);

    return (
        <Stack spacing={1}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {label ?? t('rundown.color.label')}
            </Typography>

            <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                flexWrap="wrap"
            >
                <Tooltip title={t('rundown.color.none')}>
                    <Box
                        component="button"
                        type="button"
                        aria-label={t('rundown.color.none')}
                        onClick={() => {
                            setCustomOpen(false);
                            onChange(null);
                        }}
                        sx={theme => ({
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            cursor: 'pointer',
                            bgcolor: theme.palette.surface.elevated,
                            border: `2px solid ${
                                normalized === null
                                    ? theme.palette.primary.main
                                    : theme.palette.divider
                            }`,
                            position: 'relative',
                            '&::after': {
                                content: '""',
                                position: 'absolute',
                                inset: '6px',
                                borderTop: `2px solid ${theme.palette.text.disabled}`,
                                transform: 'rotate(45deg)',
                            },
                        })}
                    />
                </Tooltip>

                {RUNDOWN_COLOR_PRESETS.map(preset => (
                    <Tooltip
                        key={preset}
                        title={t('rundown.color.swatch', { hex: preset })}
                    >
                        <Box
                            component="button"
                            type="button"
                            aria-label={t('rundown.color.swatch', {
                                hex: preset,
                            })}
                            onClick={() => {
                                setCustomOpen(false);
                                onChange(preset);
                            }}
                            sx={theme => ({
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                cursor: 'pointer',
                                bgcolor: preset,
                                border: `2px solid ${
                                    normalized === preset
                                        ? theme.palette.text.primary
                                        : 'transparent'
                                }`,
                            })}
                        />
                    </Tooltip>
                ))}

                <Button
                    size="small"
                    color="inherit"
                    onClick={() => setCustomOpen(open => !open)}
                >
                    {t('rundown.color.custom')}
                </Button>
            </Stack>

            {customOpen && (
                <MuiColorInput
                    size="small"
                    fullWidth
                    format="hex"
                    value={draft}
                    onChange={v => {
                        setDraft(v);
                        const hex = normalizeRundownColor(v);
                        if (hex) onChange(hex);
                    }}
                />
            )}
        </Stack>
    );
};
