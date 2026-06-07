import React from 'react';
import {
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Select,
    Switch,
    TextField,
} from '@mui/material';
import { useTranslation } from 'next-i18next';
import type { FieldDef } from '../fields';

interface ScalarFieldProps {
    def: Extract<
        FieldDef,
        { type: 'string' | 'number' | 'integer' | 'boolean' | 'enum' }
    >;
    value: any;
    onChange: (value: any) => void;
}

export const useLabel = () => {
    const { t } = useTranslation('common');
    return (label: string) => t(label, { defaultValue: label });
};

export const ScalarField: React.FC<ScalarFieldProps> = ({
    def,
    value,
    onChange,
}) => {
    const { t } = useTranslation('common');
    const tr = (s: string) => t(s, { defaultValue: s });
    const label = tr(def.label);

    if (def.type === 'boolean')
        return (
            <FormControlLabel
                control={
                    <Switch
                        checked={Boolean(value)}
                        onChange={e => onChange(e.target.checked)}
                    />
                }
                label={label}
                sx={{ m: 0 }}
            />
        );

    if (def.type === 'enum')
        return (
            <FormControl size="small" fullWidth>
                <InputLabel>{label}</InputLabel>
                <Select
                    label={label}
                    value={value ?? ''}
                    onChange={e =>
                        onChange(
                            e.target.value === '' ? undefined : e.target.value,
                        )
                    }
                >
                    <MenuItem value="">
                        <em>{t('config.fields.default')}</em>
                    </MenuItem>
                    {def.options.map(opt => (
                        <MenuItem key={String(opt)} value={opt}>
                            {String(opt)}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
        );

    if (def.type === 'number' || def.type === 'integer') {
        const isInt = def.type === 'integer';
        return (
            <TextField
                label={label}
                size="small"
                type="number"
                fullWidth
                value={value ?? ''}
                inputProps={isInt ? { step: 1 } : { step: 'any' }}
                onChange={e => {
                    const raw = e.target.value;
                    if (raw === '') return onChange(undefined);
                    const n = Number(raw);
                    if (!Number.isFinite(n)) return onChange(undefined);
                    onChange(isInt ? Math.round(n) : n);
                }}
            />
        );
    }

    return (
        <TextField
            label={label}
            size="small"
            fullWidth
            value={value ?? ''}
            onChange={e =>
                onChange(e.target.value === '' ? undefined : e.target.value)
            }
        />
    );
};
