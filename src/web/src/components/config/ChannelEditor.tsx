import React from 'react';
import {
    Button,
    Card,
    Divider,
    FormControl,
    IconButton,
    InputLabel,
    ListSubheader,
    MenuItem,
    Select,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { useTranslation } from 'next-i18next';
import { type CasparConfig } from '../../lib/api/caspar';
import { BUILTIN_VIDEO_MODES } from '../../lib/videoModes';
import { formatConsumerType } from './fields';
import { useContextMenu } from '../ContextMenuProvider';

type Channel = CasparConfig['channels'][number];
type Consumer = Channel['consumers'][number];
type VideoMode = CasparConfig['videoModes'][number];

interface ConsumerRowProps {
    consumer: Consumer;
    onEdit: () => void;
    onDelete: () => void;
}

const ConsumerRow: React.FC<ConsumerRowProps> = ({
    consumer,
    onEdit,
    onDelete,
}) => {
    const { t } = useTranslation('common');
    const { openMenu } = useContextMenu();
    const data = consumer.data as Record<string, unknown> | undefined;
    const summary = data
        ? Object.entries(data)
              .filter(([, v]) => v !== undefined && v !== '')
              .slice(0, 3)
              .map(
                  ([k, v]) =>
                      `${k}=${Array.isArray(v) || typeof v === 'object' ? '…' : v}`,
              )
              .join(' · ')
        : '';

    const typeLabel = t(`config.consumers.types.${consumer.type}`, {
        defaultValue: formatConsumerType(consumer.type),
    });

    return (
        <Card
            variant="outlined"
            sx={theme => ({ p: 1.5, bgcolor: theme.palette.surface.elevated })}
            onContextMenu={e =>
                openMenu(e, [
                    {
                        label: t('actions.edit'),
                        icon: <EditOutlinedIcon fontSize="small" />,
                        onClick: onEdit,
                    },
                    {
                        label: t('actions.delete'),
                        icon: <DeleteOutlineRoundedIcon fontSize="small" />,
                        danger: true,
                        divider: true,
                        onClick: onDelete,
                    },
                ])
            }
        >
            <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap={2}
            >
                <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body1">{typeLabel}</Typography>
                    {summary && (
                        <Typography
                            variant="caption"
                            sx={{
                                color: 'text.secondary',
                                fontFamily: 'monospace',
                                wordBreak: 'break-word',
                            }}
                        >
                            {summary}
                        </Typography>
                    )}
                </Stack>
                <Stack direction="row">
                    <Tooltip title={t('actions.edit')}>
                        <IconButton size="small" onClick={onEdit}>
                            <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={t('actions.delete')}>
                        <IconButton size="small" onClick={onDelete}>
                            <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Stack>
            </Stack>
        </Card>
    );
};

interface ChannelEditorProps {
    channel: Channel;
    index: number;
    videoModes: VideoMode[];
    onChange: (channel: Channel) => void;
    onDelete: () => void;
    onEditConsumer: (consumerIndex: number) => void;
    onAddConsumer: () => void;
    onDeleteConsumer: (consumerIndex: number) => void;
}

export const ChannelEditor: React.FC<ChannelEditorProps> = ({
    channel,
    index,
    videoModes,
    onChange,
    onDelete,
    onEditConsumer,
    onAddConsumer,
    onDeleteConsumer,
}) => {
    const { t } = useTranslation('common');
    const customIds = new Set(videoModes.map(m => m.id));
    const builtinModes = BUILTIN_VIDEO_MODES.filter(m => !customIds.has(m));
    const current = channel.videoMode ?? '';
    const isKnown =
        current === '' ||
        customIds.has(current) ||
        builtinModes.includes(current);
    return (
        <Card sx={{ p: 3 }}>
            <Stack spacing={2}>
                <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    gap={2}
                >
                    <Typography variant="h3">
                        {t('config.channels.channelN', { n: index + 1 })}
                    </Typography>
                    <Tooltip title={t('config.channels.deleteChannel')}>
                        <IconButton onClick={onDelete} color="error">
                            <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Stack>
                <Divider />
                <FormControl size="small" sx={{ maxWidth: 320 }}>
                    <InputLabel>{t('config.fields.videoMode')}</InputLabel>
                    <Select
                        label={t('config.fields.videoMode')}
                        value={current}
                        onChange={e =>
                            onChange({
                                ...channel,
                                videoMode: e.target.value as string,
                            })
                        }
                    >
                        {!isKnown && (
                            <MenuItem value={current}>{current}</MenuItem>
                        )}
                        {videoModes.length > 0 && [
                            <ListSubheader key="__custom-header">
                                {t('config.videoModes.custom')}
                            </ListSubheader>,
                            ...videoModes.map(m => (
                                <MenuItem key={m.id} value={m.id}>
                                    {m.id}
                                </MenuItem>
                            )),
                        ]}
                        {builtinModes.length > 0 && [
                            <ListSubheader key="__builtin-header">
                                {t('config.videoModes.builtin')}
                            </ListSubheader>,
                            ...builtinModes.map(m => (
                                <MenuItem key={m} value={m}>
                                    {m}
                                </MenuItem>
                            )),
                        ]}
                    </Select>
                </FormControl>

                <Stack spacing={1}>
                    <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                    >
                        <Typography variant="h4">
                            {t('config.consumers.title')}
                        </Typography>
                        <Button
                            startIcon={<AddRoundedIcon />}
                            size="small"
                            onClick={onAddConsumer}
                        >
                            {t('config.consumers.add')}
                        </Button>
                    </Stack>
                    {channel.consumers.length === 0 ? (
                        <Typography
                            variant="body2"
                            sx={{ color: 'text.secondary' }}
                        >
                            {t('config.consumers.empty')}
                        </Typography>
                    ) : (
                        <Stack spacing={1}>
                            {channel.consumers.map((consumer, i) => (
                                <ConsumerRow
                                    key={i}
                                    consumer={consumer}
                                    onEdit={() => onEditConsumer(i)}
                                    onDelete={() => onDeleteConsumer(i)}
                                />
                            ))}
                        </Stack>
                    )}
                </Stack>
            </Stack>
        </Card>
    );
};
