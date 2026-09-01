import React from 'react';
import {
    Box,
    Button,
    Card,
    Divider,
    IconButton,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { useTranslation } from 'react-i18next';
import { type CasparConfig } from '../../../lib/api/caspar';
import { ResolutionPicker } from './ResolutionPicker';
import { SimpleOutputRow } from './SimpleOutputRow';

type Channel = CasparConfig['channels'][number];
type VideoMode = CasparConfig['videoModes'][number];

interface SimpleChannelCardProps {
    channel: Channel;
    index: number;
    videoModes: VideoMode[];
    onChange: (channel: Channel) => void;
    onDelete: () => void;
    onEditConsumer: (consumerIndex: number) => void;
    onAddConsumer: () => void;
    onDeleteConsumer: (consumerIndex: number) => void;
    onGoAdvanced: () => void;
}

export const SimpleChannelCard: React.FC<SimpleChannelCardProps> = ({
    channel,
    index,
    videoModes,
    onChange,
    onDelete,
    onEditConsumer,
    onAddConsumer,
    onDeleteConsumer,
    onGoAdvanced,
}) => {
    const { t } = useTranslation('common');

    return (
        <Card sx={{ p: 3 }}>
            <Stack spacing={2}>
                <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    gap={2}
                >
                    <Stack spacing={0.25}>
                        <Typography variant="h3">
                            {t('config.simple.channel.title', {
                                n: index + 1,
                            })}
                        </Typography>
                        <Typography
                            variant="caption"
                            sx={{ color: 'text.secondary' }}
                        >
                            {t('config.simple.channel.outputCount', {
                                count: channel.consumers.length,
                            })}
                        </Typography>
                    </Stack>
                    <Tooltip title={t('config.simple.channel.delete')}>
                        <IconButton onClick={onDelete} color="error">
                            <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Stack>
                <Divider />

                <ResolutionPicker
                    value={channel.videoMode ?? ''}
                    customVideoModeIds={videoModes.map(m => m.id)}
                    onChange={videoMode => onChange({ ...channel, videoMode })}
                />

                <Stack spacing={1}>
                    <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                    >
                        <Typography variant="h4">
                            {t('config.simple.outputs.title')}
                        </Typography>
                        <Button
                            startIcon={<AddRoundedIcon />}
                            size="small"
                            onClick={onAddConsumer}
                        >
                            {t('config.simple.outputs.add')}
                        </Button>
                    </Stack>

                    {channel.consumers.length === 0 ? (
                        <Box
                            sx={theme => ({
                                p: 2,
                                borderRadius: 1,
                                border: `1px dashed ${theme.palette.divider}`,
                                textAlign: 'center',
                            })}
                        >
                            <Typography variant="body2">
                                {t('config.simple.outputs.empty')}
                            </Typography>
                            <Typography
                                variant="caption"
                                sx={{ color: 'text.secondary' }}
                            >
                                {t('config.simple.outputs.emptyHelp')}
                            </Typography>
                            <Box sx={{ mt: 1.5 }}>
                                <Button
                                    startIcon={<AddRoundedIcon />}
                                    size="small"
                                    variant="outlined"
                                    onClick={onAddConsumer}
                                >
                                    {t('config.simple.outputs.add')}
                                </Button>
                            </Box>
                        </Box>
                    ) : (
                        <Stack spacing={1}>
                            {channel.consumers.map((consumer, i) => (
                                <SimpleOutputRow
                                    key={i}
                                    consumer={consumer}
                                    onEdit={() => onEditConsumer(i)}
                                    onDelete={() => onDeleteConsumer(i)}
                                    onGoAdvanced={onGoAdvanced}
                                />
                            ))}
                        </Stack>
                    )}
                </Stack>
            </Stack>
        </Card>
    );
};
