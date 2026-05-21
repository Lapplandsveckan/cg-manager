import React from 'react';
import {
    Button,
    Card,
    Divider,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import {CasparConfig} from '../../lib/api/caspar';
import {formatConsumerType} from './fields';

type Channel = CasparConfig['channels'][number];
type Consumer = Channel['consumers'][number];
type VideoMode = CasparConfig['videoModes'][number];

interface ConsumerRowProps {
    consumer: Consumer;
    onEdit: () => void;
    onDelete: () => void;
}

const ConsumerRow: React.FC<ConsumerRowProps> = ({consumer, onEdit, onDelete}) => {
    const data = consumer.data as Record<string, unknown> | undefined;
    const summary = data
        ? Object.entries(data)
            .filter(([, v]) => v !== undefined && v !== '')
            .slice(0, 3)
            .map(([k, v]) => `${k}=${Array.isArray(v) || typeof v === 'object' ? '…' : v}`)
            .join(' · ')
        : '';

    return (
        <Card variant="outlined" sx={(theme) => ({p: 1.5, bgcolor: theme.palette.surface.elevated})}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                <Stack spacing={0.25} sx={{minWidth: 0, flex: 1}}>
                    <Typography variant="body1">{formatConsumerType(consumer.type)}</Typography>
                    {summary && (
                        <Typography
                            variant="caption"
                            sx={{color: 'text.secondary', fontFamily: 'monospace', wordBreak: 'break-word'}}
                        >
                            {summary}
                        </Typography>
                    )}
                </Stack>
                <Stack direction="row">
                    <Tooltip title="Edit">
                        <IconButton size="small" onClick={onEdit}>
                            <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
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
    return (
        <Card sx={{p: 3}}>
            <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
                    <Typography variant="h3">Channel {index + 1}</Typography>
                    <Tooltip title="Delete channel">
                        <IconButton onClick={onDelete} color="error">
                            <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Stack>
                <Divider />
                <FormControl size="small" sx={{maxWidth: 320}}>
                    <InputLabel>Video mode</InputLabel>
                    <Select
                        label="Video mode"
                        value={videoModes.some((m) => m.id === channel.videoMode) ? channel.videoMode : ''}
                        onChange={(e) => onChange({...channel, videoMode: e.target.value as string})}
                        displayEmpty
                        renderValue={(value) => (value ? String(value) : channel.videoMode)}
                    >
                        {videoModes.map((m) => (
                            <MenuItem key={m.id} value={m.id}>{m.id}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="h4">Consumers</Typography>
                        <Button startIcon={<AddRoundedIcon />} size="small" onClick={onAddConsumer}>
                            Add consumer
                        </Button>
                    </Stack>
                    {channel.consumers.length === 0 ? (
                        <Typography variant="body2" sx={{color: 'text.secondary'}}>
                            No consumers configured.
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
