import React from 'react';
import {
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

export interface Destination {
    channel: string;
    group: string;
}

interface DestinationFieldProps {
    value: Destination;
    channels: number[];
    onChange: (next: Destination) => void;
}

export const effectLayerOf = ({ channel, group }: Destination) =>
    `${channel}:${group}`;

export const DestinationField: React.FC<DestinationFieldProps> = ({
    value,
    channels,
    onChange,
}) => {
    const { t } = useTranslation('screenshare');

    return (
        <Stack direction="row" gap={1.5} flexWrap="wrap">
            <FormControl size="small" sx={{ flex: '0 1 140px' }}>
                <InputLabel>{t('destination.channel')}</InputLabel>
                <Select
                    label={t('destination.channel')}
                    value={value.channel}
                    onChange={e =>
                        onChange({ ...value, channel: String(e.target.value) })
                    }
                >
                    {channels.map(channel => (
                        <MenuItem key={channel} value={String(channel)}>
                            {channel}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
            <TextField
                size="small"
                label={t('destination.group')}
                value={value.group}
                onChange={e => onChange({ ...value, group: e.target.value })}
                sx={{ flex: '1 1 180px' }}
            />
        </Stack>
    );
};
