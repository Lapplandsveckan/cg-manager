import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import FiberManualRecordRoundedIcon from '@mui/icons-material/FiberManualRecordRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import {
    useBroadcast,
    useChannelInfo,
    useRegisterCommands,
    useSocket,
    type CommandItem,
} from '@web-lib';
import type { RecordingEntry } from '../recordings';
import type { RecordingPreset } from '../presets';
import { API_ROOT, recordingsUpdated } from './api';

const RecorderCommands: React.FC = () => {
    const { t } = useTranslation('common');
    const conn = useSocket();
    const { channels } = useChannelInfo();
    const [recordings, setRecordings] = useState<RecordingEntry[]>([]);

    useEffect(() => {
        conn.rawRequest(`${API_ROOT}/recordings`, 'GET', {})
            .then((res: unknown) =>
                setRecordings((res as RecordingEntry[]) ?? []),
            )
            .catch(() => setRecordings([]));
    }, [conn]);

    useBroadcast(recordingsUpdated, setRecordings);

    const isRecording = (entry: RecordingEntry) => entry.state === 'recording';
    const active = recordings.filter(isRecording);

    const start = (channel: number, presetId: string) =>
        conn.rawRequest(`${API_ROOT}/recordings`, 'ACTION', {
            channel,
            presetId,
        });

    const stop = (id: string) =>
        conn.rawRequest(`${API_ROOT}/recordings/${id}/stop`, 'ACTION', {});

    const presetCommands =
        (channel: number) => async (): Promise<CommandItem[]> => {
            const presets = (await conn.rawRequest(
                `${API_ROOT}/presets`,
                'GET',
                {},
            )) as RecordingPreset[];

            return presets.map(preset => ({
                id: `recorder.preset.${preset.id}`,
                label: t(`plugins.recorder.presets.${preset.id}`, preset.id),
                run: () => start(channel, preset.id),
            }));
        };

    const channelCommands = (): CommandItem[] =>
        channels.map(channel => ({
            id: `recorder.channel.${channel}`,
            label: t('plugins.recorder.channelN', { n: channel }),
            disabled: active.some(entry => entry.channel === channel)
                ? t('plugins.recorder.states.recording')
                : false,
            children: presetCommands(channel),
        }));

    const stopCommands = (): CommandItem[] =>
        active.map(entry => ({
            id: `recorder.recording.${entry.id}`,
            label: entry.name,
            description: t('plugins.recorder.channelN', { n: entry.channel }),
            run: () => stop(entry.id),
        }));

    useRegisterCommands(
        () => [
            {
                id: 'recorder.start',
                label: t('plugins.recorder.commands.start'),
                icon: <FiberManualRecordRoundedIcon fontSize="small" />,
                disabled: channels.length === 0,
                children: channelCommands,
            },
            {
                id: 'recorder.stop',
                label: t('plugins.recorder.commands.stop'),
                icon: <StopRoundedIcon fontSize="small" />,
                disabled: active.length === 0,
                children: stopCommands,
            },
        ],
        { section: t('nav.recorder') },
    );

    return null;
};

export default RecorderCommands;
