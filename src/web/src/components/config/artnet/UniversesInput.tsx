import React from 'react';
import { Autocomplete, Chip, TextField } from '@mui/material';
import { useTranslation } from 'next-i18next';

const parseUniverseTokens = (raw: string): number[] => {
    const out: number[] = [];
    for (const tok of raw.split(/[\s,]+/).filter(Boolean)) {
        const range = tok.match(/^(\d+)-(\d+)$/);
        if (range) {
            const a = parseInt(range[1], 10);
            const b = parseInt(range[2], 10);
            if (Number.isFinite(a) && Number.isFinite(b)) {
                const [lo, hi] = a <= b ? [a, b] : [b, a];
                for (let i = lo; i <= hi; i++) out.push(i);
            }
            continue;
        }
        const n = parseInt(tok, 10);
        if (Number.isFinite(n)) out.push(n);
    }
    return out;
};

const dedupeOrdered = (nums: number[]): number[] => {
    const seen = new Set<number>();
    const out: number[] = [];
    for (const n of nums)
        if (!seen.has(n)) {
            seen.add(n);
            out.push(n);
        }

    return out;
};

interface UniversesInputProps {
    universes: number[];
    onChange: (universes: number[]) => void;
}

export const UniversesInput: React.FC<UniversesInputProps> = ({
    universes,
    onChange,
}) => {
    const { t } = useTranslation('common');
    return (
        <Autocomplete
            multiple
            freeSolo
            autoSelect
            options={[] as string[]}
            value={universes.map(String)}
            onChange={(_, raw) => {
                const parsed = raw.flatMap(v => parseUniverseTokens(String(v)));
                onChange(dedupeOrdered(parsed));
            }}
            renderTags={(values, getTagProps) =>
                values.map((value, index) => (
                    <Chip
                        key={index}
                        size="small"
                        label={value}
                        {...getTagProps({ index })}
                    />
                ))
            }
            renderInput={params => (
                <TextField
                    {...params}
                    size="small"
                    label={t('config.artnet.universes')}
                    placeholder={
                        universes.length === 0
                            ? t('config.artnet.universesPlaceholder')
                            : ''
                    }
                    helperText={t('config.artnet.universesHelp')}
                />
            )}
        />
    );
};
