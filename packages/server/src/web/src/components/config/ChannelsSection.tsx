import React from 'react';
import { Alert, Button, Stack, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { useTranslation } from 'next-i18next/pages';
import { type CasparConfig } from '../../lib/api/caspar';
import { ChannelEditor } from './ChannelEditor';

type Channel = CasparConfig['channels'][number];
type VideoMode = CasparConfig['videoModes'][number];

interface ChannelsSectionProps {
    channels: Channel[];
    videoModes: VideoMode[];
    onAdd: () => void;
    onChange: (index: number, channel: Channel) => void;
    onDelete: (index: number) => void;
    onEditConsumer: (channelIndex: number, consumerIndex: number) => void;
    onAddConsumer: (channelIndex: number) => void;
    onDeleteConsumer: (channelIndex: number, consumerIndex: number) => void;
}

export const ChannelsSection: React.FC<ChannelsSectionProps> = ({
    channels,
    videoModes,
    onAdd,
    onChange,
    onDelete,
    onEditConsumer,
    onAddConsumer,
    onDeleteConsumer,
}) => {
    const { t } = useTranslation('common');
    return (
        <>
            <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                gap={2}
                flexWrap="wrap"
            >
                <Stack spacing={0.5}>
                    <Typography variant="h2">
                        {t('config.channels.title')}
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{ color: 'text.secondary' }}
                    >
                        {t('config.channels.count', { count: channels.length })}
                    </Typography>
                </Stack>
                <Button startIcon={<AddRoundedIcon />} onClick={onAdd}>
                    {t('config.channels.add')}
                </Button>
            </Stack>

            {channels.length === 0 ? (
                <Alert severity="warning" variant="outlined">
                    {t('config.channels.empty')}
                </Alert>
            ) : (
                <Stack spacing={2}>
                    {channels.map((channel, i) => (
                        <ChannelEditor
                            key={i}
                            channel={channel}
                            index={i}
                            videoModes={videoModes}
                            onChange={c => onChange(i, c)}
                            onDelete={() => onDelete(i)}
                            onEditConsumer={consumerIndex =>
                                onEditConsumer(i, consumerIndex)
                            }
                            onAddConsumer={() => onAddConsumer(i)}
                            onDeleteConsumer={consumerIndex =>
                                onDeleteConsumer(i, consumerIndex)
                            }
                        />
                    ))}
                </Stack>
            )}
        </>
    );
};
