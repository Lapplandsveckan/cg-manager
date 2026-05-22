import React, {useEffect, useMemo, useState} from 'react';
import {Alert, Box, Button, CircularProgress, Stack, Typography} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import {DefaultContentLayout} from '../components/DefaultContentLayout';
import {useSocket} from '../lib/hooks/useSocket';
import {CasparConfig} from '../lib/api/caspar';
import {HtmlEditor} from '../components/config/HtmlEditor';
import {LoggingEditor} from '../components/config/LoggingEditor';
import {VideoModesEditor} from '../components/config/VideoModesEditor';
import {ChannelEditor} from '../components/config/ChannelEditor';
import {ConsumerModal} from '../components/config/ConsumerModal';
import {ConsumerTypePicker} from '../components/config/ConsumerTypePicker';
import {ConsumerType} from '../components/config/fields';

type Channel = CasparConfig['channels'][number];
type Consumer = Channel['consumers'][number];

const blankChannel = (videoMode: string): Channel => ({videoMode, consumers: []});

interface EditingConsumer {
    channelIndex: number;
    consumerIndex: number | null; // null = creating
    newType?: ConsumerType;        // set when creating — chosen in the type picker
}

const Page = () => {
    const socket = useSocket();
    const [original, setOriginal] = useState<CasparConfig | null>(null);
    const [draft, setDraft] = useState<CasparConfig | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [editingConsumer, setEditingConsumer] = useState<EditingConsumer | null>(null);
    // Channel index whose "Add consumer" was clicked — shows the type picker.
    // Once the user chooses, transitions into editingConsumer with the picked
    // type baked in.
    const [pickingForChannel, setPickingForChannel] = useState<number | null>(null);

    useEffect(() => {
        if (!socket) return;
        let cancelled = false;
        setError(null);
        socket.caspar.getConfig()
            .then((data) => { if (!cancelled) { setOriginal(data); setDraft(data); } })
            .catch((err) => { if (!cancelled) setError(err?.message ?? 'Failed to load config'); });
        return () => { cancelled = true; };
    }, [socket]);

    const dirty = useMemo(() => {
        if (!original || !draft) return false;
        return JSON.stringify(original) !== JSON.stringify(draft);
    }, [original, draft]);

    const save = async () => {
        if (!draft || saving) return;
        setSaving(true);
        setError(null);
        try {
            const saved = await socket.caspar.updateConfig(draft);
            setOriginal(saved);
            setDraft(saved);
        } catch (e: any) {
            setError(e?.message ?? 'Failed to save config');
        } finally {
            setSaving(false);
        }
    };

    const discard = () => {
        if (original) setDraft(original);
    };

    const updateDraft = (patch: Partial<CasparConfig>) =>
        setDraft((d) => (d ? {...d, ...patch} : d));

    const updateChannel = (i: number, channel: Channel) =>
        setDraft((d) => d ? {...d, channels: d.channels.map((c, idx) => idx === i ? channel : c)} : d);

    const deleteChannel = (i: number) =>
        setDraft((d) => d ? {...d, channels: d.channels.filter((_, idx) => idx !== i)} : d);

    const addChannel = () =>
        setDraft((d) => {
            if (!d) return d;
            const defaultMode = d.videoModes[0]?.id ?? '1920x1080p5000';
            return {...d, channels: [...d.channels, blankChannel(defaultMode)]};
        });

    const consumerSave = (consumer: Consumer) => {
        if (!editingConsumer || !draft) return;
        const {channelIndex, consumerIndex} = editingConsumer;
        const ch = draft.channels[channelIndex];
        const consumers = consumerIndex === null
            ? [...ch.consumers, consumer]
            : ch.consumers.map((c, idx) => idx === consumerIndex ? consumer : c);
        updateChannel(channelIndex, {...ch, consumers});
    };

    const consumerDelete = () => {
        if (!editingConsumer || !draft) return;
        const {channelIndex, consumerIndex} = editingConsumer;
        if (consumerIndex === null) return;
        const ch = draft.channels[channelIndex];
        updateChannel(channelIndex, {
            ...ch,
            consumers: ch.consumers.filter((_, idx) => idx !== consumerIndex),
        });
    };

    const editingExistingConsumer: Consumer | null = (() => {
        if (!editingConsumer || !draft) return null;
        const {channelIndex, consumerIndex} = editingConsumer;
        if (consumerIndex === null) return null;
        return draft.channels[channelIndex]?.consumers[consumerIndex] ?? null;
    })();

    // Visual editors (artnet canvas, etc.) need the channel's output
    // resolution. Look it up via the channel's videoMode → videoModes entry,
    // falling back to 1080p when not found.
    const canvasSize: {width: number; height: number} = (() => {
        const fallback = {width: 1920, height: 1080};
        if (!editingConsumer || !draft) return fallback;
        const channel = draft.channels[editingConsumer.channelIndex];
        if (!channel) return fallback;
        const mode = draft.videoModes.find((m) => m.id === channel.videoMode);
        if (!mode) return fallback;
        return {width: mode.width, height: mode.height};
    })();

    return (
        <DefaultContentLayout>
            <Stack spacing={3} sx={{maxWidth: 1040}}>
                <Stack
                    direction="row"
                    alignItems={{xs: 'flex-start', sm: 'center'}}
                    justifyContent="space-between"
                    gap={2}
                    flexWrap="wrap"
                >
                    <Stack spacing={1}>
                        <Typography variant="h1">Config</Typography>
                        <Typography variant="body1" sx={{color: 'text.secondary'}}>
                            CasparCG Configuration.
                        </Typography>
                    </Stack>
                    <Stack direction="row" gap={1}>
                        <Button onClick={discard} disabled={!dirty || saving} color="inherit">
                            Discard
                        </Button>
                        <Button
                            onClick={save}
                            disabled={!dirty || saving}
                            variant="contained"
                        >
                            {saving ? 'Saving…' : 'Save'}
                        </Button>
                    </Stack>
                </Stack>

                <Alert severity="info" variant="outlined">
                    Saving writes <code>casparcg.config</code> to disk. Restart CasparCG for changes
                    to take effect — running channels are unaffected until then.
                </Alert>

                {error && (
                    <Alert severity="error" variant="outlined">
                        {error}
                    </Alert>
                )}

                {!draft && !error && (
                    <Stack direction="row" alignItems="center" gap={2}>
                        <CircularProgress size={20} />
                        <Typography variant="body2" sx={{color: 'text.secondary'}}>Loading config…</Typography>
                    </Stack>
                )}

                {draft && (
                    <>
                        <LoggingEditor
                            logLevel={draft.logLevel}
                            onChange={(logLevel) => updateDraft({logLevel})}
                        />

                        <HtmlEditor html={draft.html} onChange={(html) => updateDraft({html})} />

                        <VideoModesEditor
                            modes={draft.videoModes}
                            onChange={(videoModes) => updateDraft({videoModes})}
                        />

                        <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            gap={2}
                            flexWrap="wrap"
                        >
                            <Stack spacing={0.5}>
                                <Typography variant="h2">Channels</Typography>
                                <Typography variant="body2" sx={{color: 'text.secondary'}}>
                                    {draft.channels.length} channel{draft.channels.length === 1 ? '' : 's'}.
                                </Typography>
                            </Stack>
                            <Button startIcon={<AddRoundedIcon />} onClick={addChannel}>
                                Add channel
                            </Button>
                        </Stack>

                        {draft.channels.length === 0 ? (
                            <Alert severity="warning" variant="outlined">
                                No channels configured — CasparCG won't start without at least one.
                            </Alert>
                        ) : (
                            <Stack spacing={2}>
                                {draft.channels.map((channel, i) => (
                                    <ChannelEditor
                                        key={i}
                                        channel={channel}
                                        index={i}
                                        videoModes={draft.videoModes}
                                        onChange={(c) => updateChannel(i, c)}
                                        onDelete={() => deleteChannel(i)}
                                        onEditConsumer={(consumerIndex) =>
                                            setEditingConsumer({channelIndex: i, consumerIndex})
                                        }
                                        onAddConsumer={() => setPickingForChannel(i)}
                                        onDeleteConsumer={(consumerIndex) => {
                                            const ch = draft.channels[i];
                                            updateChannel(i, {
                                                ...ch,
                                                consumers: ch.consumers.filter((_, idx) => idx !== consumerIndex),
                                            });
                                        }}
                                    />
                                ))}
                            </Stack>
                        )}

                        <Box sx={{height: 32}} />
                    </>
                )}
            </Stack>

            <ConsumerTypePicker
                open={pickingForChannel !== null}
                onClose={() => setPickingForChannel(null)}
                onSelect={(type) => {
                    if (pickingForChannel === null) return;
                    setEditingConsumer({
                        channelIndex: pickingForChannel,
                        consumerIndex: null,
                        newType: type,
                    });
                    setPickingForChannel(null);
                }}
            />

            <ConsumerModal
                open={editingConsumer !== null}
                consumer={editingExistingConsumer}
                newType={editingConsumer?.newType}
                canvasWidth={canvasSize.width}
                canvasHeight={canvasSize.height}
                previewChannel={
                    editingConsumer !== null ? editingConsumer.channelIndex + 1 : null
                }
                onClose={() => setEditingConsumer(null)}
                onSave={consumerSave}
                onDelete={editingExistingConsumer ? consumerDelete : undefined}
            />
        </DefaultContentLayout>
    );
};

export default Page;
