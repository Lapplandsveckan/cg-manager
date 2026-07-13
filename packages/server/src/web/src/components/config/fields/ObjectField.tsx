import React from 'react';
import { Card, Stack, Typography } from '@mui/material';
import { useLabel } from './ScalarField';
import { Fields } from '../fields';
import type { FieldDef, RecordData } from '../fields';

interface ObjectFieldProps {
    def: Extract<FieldDef, { type: 'object' }>;
    value: RecordData | undefined;
    onChange: (value: RecordData | undefined) => void;
}

export const ObjectField: React.FC<ObjectFieldProps> = ({
    def,
    value,
    onChange,
}) => {
    const label = useLabel()(def.label);
    const data = value ?? {};
    const update = (key: string, v: any) => {
        const next = { ...data, [key]: v };
        const isEmpty = Object.values(next).every(
            x => x === undefined || x === '',
        );
        onChange(isEmpty ? undefined : next);
    };

    return (
        <Card
            variant="outlined"
            sx={theme => ({ p: 2, bgcolor: theme.palette.surface.elevated })}
        >
            <Stack spacing={1.5}>
                <Typography variant="h4">{label}</Typography>
                <Fields fields={def.fields} data={data} onChange={update} />
            </Stack>
        </Card>
    );
};
