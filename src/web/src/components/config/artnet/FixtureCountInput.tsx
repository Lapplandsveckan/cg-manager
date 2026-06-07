import React from 'react';
import { Stack, TextField } from '@mui/material';
import { useTranslation } from 'next-i18next';

const parseCount = (str: string | undefined): { w: number; h: number } => {
    if (!str) return { w: 1, h: 1 };
    const m = String(str).match(/^(\d+)(?:x(\d+))?$/i);
    if (!m) return { w: 1, h: 1 };
    return {
        w: parseInt(m[1], 10) || 1,
        h: m[2] ? parseInt(m[2], 10) || 1 : 1,
    };
};

const formatCount = (w: number, h: number): string => {
    const W = Math.max(1, Math.round(w));
    const H = Math.max(1, Math.round(h));
    return H === 1 ? String(W) : `${W}x${H}`;
};

interface FixtureCountInputProps {
    value: string | undefined;
    onChange: (value: string) => void;
}

export const FixtureCountInput: React.FC<FixtureCountInputProps> = ({
    value,
    onChange,
}) => {
    const { t } = useTranslation('common');
    const { w, h } = parseCount(value);
    return (
        <Stack direction="row" gap={1.5}>
            <TextField
                label={t('config.artnet.countW')}
                size="small"
                type="number"
                fullWidth
                value={w}
                inputProps={{ step: 1, min: 1 }}
                onChange={e => {
                    const n = parseInt(e.target.value, 10);
                    onChange(formatCount(Number.isFinite(n) ? n : 1, h));
                }}
            />
            <TextField
                label={t('config.artnet.countH')}
                size="small"
                type="number"
                fullWidth
                value={h}
                inputProps={{ step: 1, min: 1 }}
                onChange={e => {
                    const n = parseInt(e.target.value, 10);
                    onChange(formatCount(w, Number.isFinite(n) ? n : 1));
                }}
            />
        </Stack>
    );
};
