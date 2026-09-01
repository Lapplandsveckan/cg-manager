import React from 'react';
import { Card, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
    ARTNET_SCALAR_FIELDS,
    Fields,
    type FieldDef,
    type RecordData,
    type FieldValue,
} from '../../fields';

interface OutputCardProps {
    data: RecordData;
    onChange: (key: string, value: FieldValue) => void;
    /** Override the default scalar fields (host/port/refreshRate). */
    fields?: FieldDef[];
    children?: React.ReactNode;
}

export const OutputCard: React.FC<OutputCardProps> = ({
    data,
    onChange,
    fields = ARTNET_SCALAR_FIELDS,
    children,
}) => {
    const { t } = useTranslation('common');
    return (
        <Card
            variant="outlined"
            sx={theme => ({
                p: 2,
                bgcolor: theme.palette.surface.elevated,
            })}
        >
            <Stack spacing={2}>
                <Typography variant="h4">
                    {t('config.artnet.output')}
                </Typography>
                {children}
                <Fields fields={fields} data={data} onChange={onChange} />
            </Stack>
        </Card>
    );
};
