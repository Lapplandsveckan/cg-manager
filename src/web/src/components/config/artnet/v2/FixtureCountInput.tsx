import React from 'react';
import { Stack, TextField } from '@mui/material';
import { useTranslation } from 'next-i18next';
import { parseCount, formatCount } from './v2Fixture';

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
