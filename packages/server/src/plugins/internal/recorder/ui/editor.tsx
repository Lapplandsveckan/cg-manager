import React, { useEffect, useState } from 'react';
import { MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import { RundownEditorActionBar, useSocket } from '@web-lib';
import { useTranslation } from 'react-i18next';
import { type RecordingPreset } from '../presets';

interface Data {
    channel?: number;
    presetId?: string;
    name?: string;
    durationSec?: number;
}

interface Entry {
    id: string;
    title: string;
    type: string;
    data?: Data;
    metadata?: { color?: string };
}

interface Props {
    entry: Entry;
    creating: boolean;
    updateEntry: (entry: Entry) => void;
    deleteEntry: (entry: Entry) => void;
}

const RecordChannelEditor: React.FC<Props> = ({
    entry,
    creating,
    updateEntry,
    deleteEntry,
}) => {
    const conn = useSocket();
    const { t } = useTranslation('recorder');

    const [title, setTitle] = useState(entry.title ?? '');
    const [channels, setChannels] = useState<number[]>([]);
    const [presets, setPresets] = useState<RecordingPreset[]>([]);
    const [channel, setChannel] = useState(entry.data?.channel ?? 1);
    const [presetId, setPresetId] = useState(entry.data?.presetId ?? '');
    const [name, setName] = useState(entry.data?.name ?? '');
    const [durationSec, setDurationSec] = useState(
        entry.data?.durationSec ? String(entry.data.durationSec) : '',
    );

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
        conn.rawRequest('/api/plugin/recorder/presets', 'GET', {})
            .then((res: unknown) => {
                const list = (res as RecordingPreset[]) ?? [];
                setPresets(list);
                setPresetId(prev => prev || list[0]?.id || '');
            })
            .catch(() => setPresets([]));
    }, [conn]);

    const onSave = () => {
        updateEntry({
            ...entry,
            title: title.trim() || t('defaultTitle'),
            data: {
                channel,
                presetId,
                name: name.trim() || undefined,
                durationSec: durationSec ? Number(durationSec) : undefined,
            },
        });
    };

    return (
        <Stack spacing={2.5}>
            <Stack spacing={0.5}>
                <Typography variant="h3">{t('editor.title')}</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {t('editor.description')}
                </Typography>
            </Stack>

            <TextField
                label={t('editor.titleLabel')}
                value={title}
                onChange={e => setTitle(e.target.value)}
                size="small"
                fullWidth
            />

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

            <Select
                size="small"
                value={presetId}
                onChange={e => setPresetId(e.target.value)}
            >
                {presets.map(preset => (
                    <MenuItem key={preset.id} value={preset.id}>
                        {t(`presets.${preset.id}`, preset.id)}
                    </MenuItem>
                ))}
            </Select>

            <TextField
                size="small"
                label={t('name')}
                value={name}
                onChange={e => setName(e.target.value)}
                fullWidth
            />

            <TextField
                size="small"
                type="number"
                label={t('durationSec')}
                helperText={t('editor.durationHint')}
                value={durationSec}
                onChange={e => setDurationSec(e.target.value)}
            />

            <RundownEditorActionBar
                onSave={onSave}
                onDelete={creating ? undefined : () => deleteEntry(entry)}
            />
        </Stack>
    );
};

export default RecordChannelEditor;
