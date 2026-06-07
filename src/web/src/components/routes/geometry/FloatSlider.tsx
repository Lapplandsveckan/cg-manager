import React from 'react';
import { Slider, Stack, TextField, Typography } from '@mui/material';

interface FloatSliderProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (v: number) => void;
}

export const FloatSlider: React.FC<FloatSliderProps> = ({
    label,
    value,
    min,
    max,
    step,
    onChange,
}) => (
    <Stack spacing={0.5}>
        <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
        >
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {label}
            </Typography>
            <TextField
                size="small"
                type="number"
                value={value}
                onChange={e => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n)) onChange(n);
                }}
                inputProps={{ step, min, max }}
                sx={{ width: 100 }}
            />
        </Stack>
        <Slider
            size="small"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(_, v) => onChange(typeof v === 'number' ? v : v[0])}
        />
    </Stack>
);
