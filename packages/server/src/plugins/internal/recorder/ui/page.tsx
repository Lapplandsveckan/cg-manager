import React, { useEffect, useState } from 'react';
import {
    Box,
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    IconButton,
    List,
    ListItem,
    ListItemText,
    MenuItem,
    Select,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import FiberManualRecordRoundedIcon from '@mui/icons-material/FiberManualRecordRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import DriveFolderUploadRoundedIcon from '@mui/icons-material/DriveFolderUploadRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import {
    ChannelPreview,
    pluginHttpUrl,
    useBroadcast,
    useSocket,
    useToast,
} from '@web-lib';
import { useTranslation } from 'react-i18next';
import { type RecordingEntry } from '../recordings';
import { type RecordingPreset } from '../presets';
import { API_ROOT, PLUGIN, recordingsUpdated } from './api';

const RecorderPage: React.FC = () => {
    const conn = useSocket();
    const { t } = useTranslation('recorder');
    const notify = useToast();

    const [channels, setChannels] = useState<number[]>([]);
    const [presets, setPresets] = useState<RecordingPreset[]>([]);
    const [recordings, setRecordings] = useState<RecordingEntry[] | null>(null);

    const [channel, setChannel] = useState(1);
    const [presetId, setPresetId] = useState('');
    const [name, setName] = useState('');
    const [autoStop, setAutoStop] = useState(false);
    const [durationSec, setDurationSec] = useState('30');
    const [starting, setStarting] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);

    useEffect(() => {
        if (!conn) return;
        conn.caspar
            .getConfig()
            .then(cfg =>
                setChannels(cfg.channels.map((_: unknown, i: number) => i + 1)),
            )
            .catch(() => {
                /* caspar not connected */
            });
    }, [conn]);

    useEffect(() => {
        if (!conn) return;
        conn.rawRequest(`${API_ROOT}/presets`, 'GET', {})
            .then((res: unknown) => {
                const list = (res as RecordingPreset[]) ?? [];
                setPresets(list);
                setPresetId(prev => prev || list[0]?.id || '');
            })
            .catch(() => setPresets([]));
    }, [conn]);

    useEffect(() => {
        if (!conn) return;
        let mounted = true;

        conn.rawRequest(`${API_ROOT}/recordings`, 'GET', {})
            .then((res: unknown) => {
                if (mounted) setRecordings((res as RecordingEntry[]) ?? []);
            })
            .catch(() => mounted && setRecordings([]));

        return () => {
            mounted = false;
        };
    }, [conn]);

    useBroadcast(recordingsUpdated, setRecordings);

    const activeOnChannel = (ch: number) =>
        recordings?.find(r => r.channel === ch && r.state === 'recording');

    const activeRecording = activeOnChannel(channel);
    const presetLabel = (id: string) => t(`presets.${id}`, id);

    const start = async () => {
        if (!conn || !presetId) return;
        setStarting(true);
        const [, error] = await conn
            .rawRequest(`${API_ROOT}/recordings`, 'ACTION', {
                channel,
                presetId,
                name: name.trim() || undefined,
                durationSec:
                    autoStop && durationSec ? Number(durationSec) : undefined,
            })
            .then(() => [null, null])
            .catch((err: Error) => [null, err]);
        setStarting(false);
        if (error) notify(error.message ?? t('errors.startFailed'), 'error');
    };

    const stop = async (id: string) => {
        if (!conn) return;
        await conn
            .rawRequest(`${API_ROOT}/recordings/${id}/stop`, 'ACTION', {})
            .catch(() => null);
    };

    const importToMedia = async (id: string) => {
        if (!conn) return;
        const [, error] = await conn
            .rawRequest(`${API_ROOT}/recordings/${id}/import`, 'ACTION', {})
            .then(() => [null, null])
            .catch((err: Error) => [null, err]);
        if (error) notify(error.message ?? t('errors.importFailed'), 'error');
        else notify(t('importDone'), 'success');
    };

    const remove = async (id: string) => {
        if (!conn) return;
        await conn
            .rawRequest(`${API_ROOT}/recordings/${id}`, 'DELETE', {})
            .catch(() => null);
    };

    return (
        <Box sx={{ p: 2, maxWidth: 820 }}>
            <Typography variant="h1" mb={2}>
                {t('nav')}
            </Typography>

            <Stack direction="row" gap={3} mb={3} flexWrap="wrap">
                <Stack spacing={1} sx={{ width: 360, flexShrink: 0 }}>
                    <Select
                        size="small"
                        value={channel}
                        onChange={e => setChannel(Number(e.target.value))}
                    >
                        {channels.map(ch => (
                            <MenuItem key={ch} value={ch}>
                                {t('channelN', { n: ch })}
                            </MenuItem>
                        ))}
                    </Select>

                    <Box
                        sx={{
                            position: 'relative',
                            width: '100%',
                            aspectRatio: '16 / 9',
                            bgcolor: 'black',
                            borderRadius: 1,
                            overflow: 'hidden',
                        }}
                    >
                        <ChannelPreview channel={channel} objectFit="contain" />
                    </Box>
                </Stack>

                <Stack spacing={2} sx={{ flex: 1, minWidth: 220 }}>
                    <Stack direction="row" gap={1.5}>
                        {activeRecording ? (
                            <Button
                                variant="contained"
                                color="error"
                                startIcon={<StopRoundedIcon />}
                                onClick={() => stop(activeRecording.id)}
                            >
                                {t('stop')}
                            </Button>
                        ) : (
                            <Button
                                variant="contained"
                                startIcon={<FiberManualRecordRoundedIcon />}
                                disabled={starting || !presetId}
                                onClick={start}
                            >
                                {t('start')}
                            </Button>
                        )}

                        <Tooltip title={t('settings')}>
                            <IconButton
                                onClick={() => setSettingsOpen(true)}
                                sx={{ border: 1, borderColor: 'divider' }}
                            >
                                <TuneRoundedIcon />
                            </IconButton>
                        </Tooltip>
                    </Stack>

                    <Stack spacing={0.5}>
                        <Typography
                            variant="body2"
                            sx={{ color: 'text.secondary' }}
                        >
                            {presetId
                                ? presetLabel(presetId)
                                : t('choosePreset')}
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{ color: 'text.secondary' }}
                        >
                            {autoStop
                                ? t('autoStopSummary', {
                                      seconds: durationSec,
                                  })
                                : t('manualStopSummary')}
                        </Typography>
                    </Stack>
                </Stack>
            </Stack>

            <Dialog
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                fullWidth
                maxWidth="xs"
            >
                <DialogTitle>{t('settings')}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2.5} mt={0.5}>
                        <TextField
                            size="small"
                            label={t('name')}
                            placeholder={t('namePlaceholder')}
                            value={name}
                            onChange={e => setName(e.target.value)}
                            disabled={Boolean(activeRecording)}
                            fullWidth
                        />

                        <Select
                            size="small"
                            value={presetId}
                            onChange={e => setPresetId(e.target.value)}
                            disabled={
                                Boolean(activeRecording) || !presets.length
                            }
                            fullWidth
                        >
                            {presets.map(preset => (
                                <MenuItem key={preset.id} value={preset.id}>
                                    {presetLabel(preset.id)}
                                </MenuItem>
                            ))}
                        </Select>

                        <Stack spacing={1}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={autoStop}
                                        disabled={Boolean(activeRecording)}
                                        onChange={e =>
                                            setAutoStop(e.target.checked)
                                        }
                                    />
                                }
                                label={t('autoStop')}
                            />
                            {autoStop && (
                                <TextField
                                    size="small"
                                    type="number"
                                    label={t('afterSeconds')}
                                    value={durationSec}
                                    disabled={Boolean(activeRecording)}
                                    onChange={e =>
                                        setDurationSec(e.target.value)
                                    }
                                    sx={{ width: 180 }}
                                />
                            )}
                        </Stack>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSettingsOpen(false)}>
                        {t('common:actions.done')}
                    </Button>
                </DialogActions>
            </Dialog>

            <List dense disablePadding>
                {recordings === null && (
                    <ListItem>
                        <ListItemText secondary={t('common:actions.loading')} />
                    </ListItem>
                )}
                {recordings?.length === 0 && (
                    <ListItem>
                        <ListItemText secondary={t('noRecordings')} />
                    </ListItem>
                )}
                {(recordings ?? []).map(recording => (
                    <ListItem
                        key={recording.id}
                        secondaryAction={
                            <Stack direction="row" gap={0.5}>
                                {recording.state !== 'recording' && (
                                    <>
                                        <Tooltip title={t('download')}>
                                            <IconButton
                                                size="small"
                                                component="a"
                                                href={pluginHttpUrl(
                                                    PLUGIN,
                                                    `files/${recording.id}`,
                                                )}
                                                download
                                            >
                                                <DownloadRoundedIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title={t('importToMedia')}>
                                            <IconButton
                                                size="small"
                                                onClick={() =>
                                                    importToMedia(recording.id)
                                                }
                                            >
                                                <DriveFolderUploadRoundedIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip
                                            title={t('common:actions.delete')}
                                        >
                                            <IconButton
                                                size="small"
                                                onClick={() =>
                                                    remove(recording.id)
                                                }
                                            >
                                                <DeleteOutlineRoundedIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </>
                                )}
                            </Stack>
                        }
                    >
                        <ListItemText
                            primary={`${recording.name} — ${t('channelN', { n: recording.channel })}`}
                            secondary={t(`states.${recording.state}`)}
                        />
                    </ListItem>
                ))}
            </List>
        </Box>
    );
};

export const meta = {
    label: 'recorder:nav',
    icon: FiberManualRecordRoundedIcon,
};

export default RecorderPage;
