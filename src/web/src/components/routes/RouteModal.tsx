import React, {useEffect, useMemo, useState} from 'react';
import {
    Box,
    Button,
    Card,
    FormControl,
    InputLabel,
    MenuItem,
    Modal,
    Select,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import {VideoRoute, VideoRouteSource, VideoRouteDestination} from '../../lib/api/videoRoutes';
import type {SourceType} from './RouteSourceTypePicker';
import {DraftSource, SourceFields, defaultSourceFor, sourceToDraft} from './RouteSourceFields';

interface DraftDestination {
    channel: string;
    group: string;
    index: string;
}

interface RouteModalProps {
    open: boolean;
    /** Existing route to edit. Null when adding — `newType` must then be set. */
    route: VideoRoute | null;
    newType?: SourceType;
    channels: number[];
    /** Video-mode ids from the CG config — used for the decklink format dropdown. */
    videoModes: string[];
    onClose: () => void;
    onSave: (data: Omit<VideoRoute, 'id'>) => Promise<void>;
    onDelete?: () => void;
}

function intOrUndef(raw: string): number | undefined {
    if (raw.trim() === '') return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

const SOURCE_TITLE: Record<SourceType, string> = {
    decklink: 'Decklink',
    video: 'Video file',
    channel: 'Channel',
    color: 'Color',
};

function destinationToDraft(dest: VideoRouteDestination): DraftDestination {
    const [c, ...rest] = dest.effectLayer.split(':');
    return {
        channel: c ?? '',
        group: rest.join(':'),
        index: dest.index !== undefined ? String(dest.index) : '',
    };
}

function emptyDestinationDraft(channels: number[]): DraftDestination {
    return {
        channel: channels[0] !== undefined ? String(channels[0]) : '1',
        group: 'main',
        index: '',
    };
}

interface DestinationFieldsProps {
    draft: DraftDestination;
    channels: number[];
    onChange: (draft: DraftDestination) => void;
}

const DestinationFields: React.FC<DestinationFieldsProps> = ({draft, channels, onChange}) => {
    // Allow channels that exist OR whatever is already in the draft (so editing
    // a route pointed at a now-removed channel doesn't silently snap to ch 1).
    const channelOptions = useMemo(() => {
        const opts = new Set(channels.map((c) => String(c)));
        if (draft.channel) opts.add(draft.channel);
        return Array.from(opts).sort((a, b) => Number(a) - Number(b));
    }, [channels, draft.channel]);

    return (
        <Stack direction="row" gap={1.5} flexWrap="wrap">
            <FormControl size="small" sx={{flex: '1 1 140px'}}>
                <InputLabel>Channel</InputLabel>
                <Select
                    label="Channel"
                    value={draft.channel}
                    onChange={(e) => onChange({...draft, channel: String(e.target.value)})}
                >
                    {channelOptions.map((ch) => (
                        <MenuItem key={ch} value={ch}>{ch}</MenuItem>
                    ))}
                </Select>
            </FormControl>
            <TextField
                label="Group"
                size="small"
                placeholder="main"
                value={draft.group}
                onChange={(e) => onChange({...draft, group: e.target.value})}
                sx={{flex: '2 1 200px'}}
            />
            <TextField
                label="Index (optional)"
                size="small"
                type="number"
                value={draft.index}
                onChange={(e) => onChange({...draft, index: e.target.value})}
                inputProps={{step: 1, min: 0}}
                sx={{flex: '1 1 160px'}}
            />
        </Stack>
    );
};

export const RouteModal: React.FC<RouteModalProps> = ({
    open,
    route,
    newType,
    channels,
    videoModes,
    onClose,
    onSave,
    onDelete,
}) => {
    const [name, setName] = useState('');
    const [source, setSource] = useState<DraftSource>(defaultSourceFor('color'));
    const [destination, setDestination] = useState<DraftDestination>(emptyDestinationDraft([]));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setError(null);
        if (route) {
            setName(route.name ?? '');
            setSource(sourceToDraft(route.source));
            setDestination(destinationToDraft(route.destination));
        } else {
            const type = newType ?? 'color';
            setName('');
            setSource(defaultSourceFor(type));
            setDestination(emptyDestinationDraft(channels));
        }
    }, [open, route, newType, channels]);

    // The persisted route's source type wins over the picker choice when
    // editing — the user can't change a route's source type after the fact
    // (would invalidate effect-layer wiring downstream).
    const activeType: SourceType = route ? route.source.type : (newType ?? 'color');

    const buildSource = (): VideoRouteSource | string => {
        if (source.type === 'decklink') {
            const device = intOrUndef(source.device);
            const keyDevice = intOrUndef(source.keyDevice);
            if (device === undefined) return 'Decklink device is required';
            if (!source.format.trim()) return 'Decklink format is required';
            return {
                type: 'decklink',
                device,
                format: source.format.trim(),
                ...(keyDevice !== undefined ? {keyDevice} : {}),
            };
        }
        if (source.type === 'video') {
            const video = source.video.trim();
            if (!video) return 'Video file is required';
            return {type: 'video', video};
        }
        if (source.type === 'channel') {
            const channel = intOrUndef(source.channel);
            if (channel === undefined) return 'Channel is required';
            return {type: 'channel', channel};
        }
        // color
        const color = source.color.trim();
        if (!color) return 'Color is required';
        return {type: 'color', color};
    };

    const buildDestination = (): VideoRouteDestination | string => {
        const ch = destination.channel.trim();
        const group = destination.group.trim();
        if (!ch) return 'Destination channel is required';
        if (!group) return 'Destination group is required';
        if (group.includes(':')) return 'Destination group cannot contain `:`';
        const idx = intOrUndef(destination.index);
        return {
            type: 'effect-group',
            effectLayer: `${ch}:${group}`,
            ...(idx !== undefined ? {index: idx} : {}),
        };
    };

    const handleSave = async () => {
        const src = buildSource();
        if (typeof src === 'string') return setError(src);
        const dest = buildDestination();
        if (typeof dest === 'string') return setError(dest);

        setBusy(true);
        setError(null);
        try {
            await onSave({
                name: name.trim(),
                source: src,
                destination: dest,
                // Default to enabled for new routes; preserve current state
                // when editing. The Switch on the card is still the canonical
                // toggle for live activation.
                enabled: route?.enabled ?? true,
                ...(route?.transform   ? {transform:   route.transform}   : {}),
                ...(route?.edgeblend   ? {edgeblend:   route.edgeblend}   : {}),
                ...(route?.perspective ? {perspective: route.perspective} : {}),
                ...(route?.metadata    ? {metadata:    route.metadata}    : {}),
            });
            onClose();
        } catch (e) {
            setError((e as Error)?.message ?? 'Failed to save route');
        } finally {
            setBusy(false);
        }
    };

    const titleVerb = route ? 'Edit' : 'Add';
    const hasAdvanced = Boolean(route?.transform || route?.edgeblend || route?.perspective);

    return (
        <Modal open={open} onClose={busy ? undefined : onClose}>
            <Box
                sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 'min(720px, 95vw)',
                    maxHeight: '95vh',
                    overflowY: 'auto',
                }}
            >
                <Card sx={{p: 3}}>
                    <Stack spacing={3}>
                        <Stack spacing={0.5}>
                            <Stack direction="row" alignItems="baseline" gap={1.5} flexWrap="wrap">
                                <Typography variant="h3">
                                    {titleVerb} {SOURCE_TITLE[activeType].toLowerCase()} route
                                </Typography>
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: 'text.secondary',
                                        fontFamily: 'monospace',
                                        textTransform: 'lowercase',
                                    }}
                                >
                                    {activeType}
                                </Typography>
                            </Stack>
                            <Typography variant="body2" sx={{color: 'text.secondary'}}>
                                Routes are persisted to disk and take effect immediately. Source
                                type can&apos;t be changed after creation.
                            </Typography>
                        </Stack>

                        <TextField
                            label="Name"
                            size="small"
                            fullWidth
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />

                        <Stack spacing={1.5}>
                            <Typography variant="h4">Source</Typography>
                            <SourceFields
                                draft={source}
                                channels={channels}
                                videoModes={videoModes}
                                setDraft={setSource}
                            />
                        </Stack>

                        <Stack spacing={1.5}>
                            <Typography variant="h4">Destination</Typography>
                            <DestinationFields
                                draft={destination}
                                channels={channels}
                                onChange={setDestination}
                            />
                            <Typography variant="caption" sx={{color: 'text.disabled'}}>
                                Effect-group layer is &quot;channel:group&quot;. Index disambiguates
                                multiple groups with the same name on a channel.
                            </Typography>
                        </Stack>

                        {hasAdvanced && (
                            <Typography variant="caption" sx={{color: 'text.secondary'}}>
                                This route has transform / edgeblend / perspective data set. The
                                UI doesn&apos;t expose these yet — they&apos;re preserved on save.
                                Visual editor TODO.
                            </Typography>
                        )}

                        {error && (
                            <Typography variant="body2" color="error">{error}</Typography>
                        )}

                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Box>
                                {onDelete && route && (
                                    <Button
                                        color="error"
                                        disabled={busy}
                                        onClick={() => { onDelete(); onClose(); }}
                                    >
                                        Delete
                                    </Button>
                                )}
                            </Box>
                            <Stack direction="row" gap={1}>
                                <Button onClick={onClose} color="inherit" disabled={busy}>
                                    Cancel
                                </Button>
                                <Button onClick={handleSave} variant="contained" disabled={busy}>
                                    {busy ? 'Saving…' : 'Save'}
                                </Button>
                            </Stack>
                        </Stack>
                    </Stack>
                </Card>
            </Box>
        </Modal>
    );
};
