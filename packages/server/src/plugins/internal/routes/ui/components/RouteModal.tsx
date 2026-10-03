import React, { useEffect, useMemo, useState } from 'react';
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
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { useTranslation } from 'react-i18next';
import { noTryAsync } from 'no-try';
import {
    type VideoRoute,
    type VideoRouteSource,
    type VideoRouteDestination,
} from '../api';
import type { SourceType } from './RouteSourceTypePicker';
import {
    type DraftSource,
    SourceFields,
    defaultSourceFor,
    sourceToDraft,
} from './RouteSourceFields';
import { GeometryEditor, type GeometryValues } from './GeometryEditor';

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
    /** Per-channel output resolution. Drives the GeometryEditor stage canvas
     *  size for the route's destination channel. Falls back to 1920×1080. */
    channelSizes: Record<number, { width: number; height: number }>;
    onClose: () => void;
    onSave: (data: Omit<VideoRoute, 'id'>) => Promise<void>;
    onDelete?: () => void;
}

const FALLBACK_CANVAS = { width: 1920, height: 1080 };

function intOrUndef(raw: string): number | undefined {
    if (raw.trim() === '') return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

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

const DestinationFields: React.FC<DestinationFieldsProps> = ({
    draft,
    channels,
    onChange,
}) => {
    const { t } = useTranslation('routes');
    // Keeps a removed channel selectable so editing doesn't snap to ch 1.
    const channelOptions = useMemo(() => {
        const opts = new Set(channels.map(c => String(c)));
        if (draft.channel) opts.add(draft.channel);
        return Array.from(opts).sort((a, b) => Number(a) - Number(b));
    }, [channels, draft.channel]);

    return (
        <Stack direction="row" gap={1.5} flexWrap="wrap">
            <FormControl size="small" sx={{ flex: '1 1 140px' }}>
                <InputLabel>{t('fields.channel')}</InputLabel>
                <Select
                    label={t('fields.channel')}
                    value={draft.channel}
                    onChange={e =>
                        onChange({ ...draft, channel: String(e.target.value) })
                    }
                >
                    {channelOptions.map(ch => (
                        <MenuItem key={ch} value={ch}>
                            {ch}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
            <TextField
                label={t('fields.group')}
                size="small"
                placeholder="main"
                value={draft.group}
                onChange={e => onChange({ ...draft, group: e.target.value })}
                sx={{ flex: '2 1 200px' }}
            />
            <TextField
                label={t('fields.indexOptional')}
                size="small"
                type="number"
                value={draft.index}
                onChange={e => onChange({ ...draft, index: e.target.value })}
                inputProps={{ step: 1, min: 0 }}
                sx={{ flex: '1 1 160px' }}
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
    channelSizes,
    onClose,
    onSave,
    onDelete,
}) => {
    const { t } = useTranslation('routes');
    const [name, setName] = useState('');
    const [source, setSource] = useState<DraftSource>(
        defaultSourceFor('color'),
    );
    const [destination, setDestination] = useState<DraftDestination>(
        emptyDestinationDraft([]),
    );
    const [geometry, setGeometry] = useState<GeometryValues>({});
    const [geometryOpen, setGeometryOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setError(null);
        if (route) {
            setName(route.name ?? '');
            setSource(sourceToDraft(route.source));
            setDestination(destinationToDraft(route.destination));
            setGeometry({
                ...(route.transform ? { transform: route.transform } : {}),
                ...(route.perspective
                    ? { perspective: route.perspective }
                    : {}),
                ...(route.edgeblend ? { edgeblend: route.edgeblend } : {}),
            });
            return;
        }

        const type = newType ?? 'color';
        setName('');
        setSource(defaultSourceFor(type));
        setDestination(emptyDestinationDraft(channels));
        setGeometry({});
    }, [open, route, newType, channels]);

    const canvasSize = useMemo(() => {
        const ch = Number(destination.channel);
        return Number.isFinite(ch)
            ? (channelSizes[ch] ?? FALLBACK_CANVAS)
            : FALLBACK_CANVAS;
    }, [destination.channel, channelSizes]);

    const geometryActive = Boolean(
        geometry.transform || geometry.perspective || geometry.edgeblend,
    );

    const activeType: SourceType = route
        ? route.source.type
        : (newType ?? 'color');

    const buildSource = (): VideoRouteSource | string => {
        if (source.type === 'decklink') {
            const device = intOrUndef(source.device);
            const keyDevice = intOrUndef(source.keyDevice);
            if (device === undefined) return t('errors.decklinkDeviceRequired');
            if (!source.format.trim())
                return t('errors.decklinkFormatRequired');
            return {
                type: 'decklink',
                device,
                format: source.format.trim(),
                ...(keyDevice !== undefined ? { keyDevice } : {}),
            };
        }
        if (source.type === 'video') {
            const video = source.video.trim();
            if (!video) return t('errors.videoRequired');
            return { type: 'video', video };
        }
        if (source.type === 'channel') {
            const channel = intOrUndef(source.channel);
            if (channel === undefined) return t('errors.channelRequired');
            return { type: 'channel', channel };
        }
        const color = source.color.trim();
        if (!color) return t('errors.colorRequired');
        return { type: 'color', color };
    };

    const buildDestination = (): VideoRouteDestination | string => {
        const ch = destination.channel.trim();
        const group = destination.group.trim();
        if (!ch) return t('errors.destinationChannelRequired');
        if (!group) return t('errors.destinationGroupRequired');
        if (group.includes(':')) return t('errors.destinationGroupColon');
        const idx = intOrUndef(destination.index);
        return {
            type: 'effect-group',
            effectLayer: `${ch}:${group}`,
            ...(idx !== undefined ? { index: idx } : {}),
        };
    };

    const handleSave = async () => {
        const src = buildSource();
        if (typeof src === 'string') return setError(src);
        const dest = buildDestination();
        if (typeof dest === 'string') return setError(dest);

        setBusy(true);
        setError(null);
        const [err] = await noTryAsync(async () => {
            await onSave({
                name: name.trim(),
                source: src,
                destination: dest,
                enabled: route?.enabled ?? true,
                ...(geometry.transform
                    ? { transform: geometry.transform }
                    : {}),
                ...(geometry.perspective
                    ? { perspective: geometry.perspective }
                    : {}),
                ...(geometry.edgeblend
                    ? { edgeblend: geometry.edgeblend }
                    : {}),
                ...(route?.metadata ? { metadata: route.metadata } : {}),
            });
            onClose();
        });

        if (err) setError((err as Error)?.message ?? t('errors.saveFailed'));
        setBusy(false);
    };

    const title = route
        ? t('modal.editTitle', {
              type: t(`sourceTypes.${activeType}`).toLowerCase(),
          })
        : t('modal.addTitle', {
              type: t(`sourceTypes.${activeType}`).toLowerCase(),
          });

    return (
        <>
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
                    <Card sx={{ p: 3 }}>
                        <Stack spacing={3}>
                            <Stack spacing={0.5}>
                                <Stack
                                    direction="row"
                                    alignItems="baseline"
                                    gap={1.5}
                                    flexWrap="wrap"
                                >
                                    <Typography variant="h3">
                                        {title}
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
                                <Typography
                                    variant="body2"
                                    sx={{ color: 'text.secondary' }}
                                >
                                    {t('modal.description')}
                                </Typography>
                            </Stack>

                            <TextField
                                label={t('fields.name')}
                                size="small"
                                fullWidth
                                value={name}
                                onChange={e => setName(e.target.value)}
                            />

                            <Stack spacing={1.5}>
                                <Typography variant="h4">
                                    {t('sections.source')}
                                </Typography>
                                <SourceFields
                                    draft={source}
                                    channels={channels}
                                    videoModes={videoModes}
                                    setDraft={setSource}
                                />
                            </Stack>

                            <Stack spacing={1.5}>
                                <Typography variant="h4">
                                    {t('sections.destination')}
                                </Typography>
                                <DestinationFields
                                    draft={destination}
                                    channels={channels}
                                    onChange={setDestination}
                                />
                                <Typography
                                    variant="caption"
                                    sx={{ color: 'text.disabled' }}
                                >
                                    {t('destinationHint')}
                                </Typography>
                            </Stack>

                            <Stack spacing={1}>
                                <Typography variant="h4">
                                    {t('sections.geometry')}
                                </Typography>
                                <Stack
                                    direction="row"
                                    alignItems="center"
                                    gap={1.5}
                                    flexWrap="wrap"
                                >
                                    <Button
                                        variant="outlined"
                                        color="inherit"
                                        size="small"
                                        startIcon={<TuneRoundedIcon />}
                                        onClick={() => setGeometryOpen(true)}
                                    >
                                        {geometryActive
                                            ? t('geometry.editButton')
                                            : t('geometry.addButton')}
                                    </Button>
                                    <Typography
                                        variant="caption"
                                        sx={{ color: 'text.secondary' }}
                                    >
                                        {geometryActive
                                            ? [
                                                  geometry.transform
                                                      ? t(
                                                            'geometry.parts.position',
                                                        )
                                                      : null,
                                                  geometry.perspective
                                                      ? t(
                                                            'geometry.parts.perspective',
                                                        )
                                                      : null,
                                                  geometry.edgeblend
                                                      ? t(
                                                            'geometry.parts.edgeblend',
                                                        )
                                                      : null,
                                              ]
                                                  .filter(Boolean)
                                                  .join(' · ')
                                            : t('geometry.noneSet')}
                                    </Typography>
                                </Stack>
                            </Stack>

                            {error && (
                                <Typography variant="body2" color="error">
                                    {error}
                                </Typography>
                            )}

                            <Stack
                                direction="row"
                                justifyContent="space-between"
                                alignItems="center"
                            >
                                <Box>
                                    {onDelete && route && (
                                        <Button
                                            color="error"
                                            disabled={busy}
                                            onClick={() => {
                                                onDelete();
                                                onClose();
                                            }}
                                        >
                                            {t('common:actions.delete')}
                                        </Button>
                                    )}
                                </Box>
                                <Stack direction="row" gap={1}>
                                    <Button
                                        onClick={onClose}
                                        color="inherit"
                                        disabled={busy}
                                    >
                                        {t('common:actions.cancel')}
                                    </Button>
                                    <Button
                                        onClick={handleSave}
                                        variant="contained"
                                        disabled={busy}
                                    >
                                        {busy
                                            ? t('saving')
                                            : t('common:actions.save')}
                                    </Button>
                                </Stack>
                            </Stack>
                        </Stack>
                    </Card>
                </Box>
            </Modal>
            <GeometryEditor
                open={geometryOpen}
                value={geometry}
                canvasWidth={canvasSize.width}
                canvasHeight={canvasSize.height}
                previewChannel={Number(destination.channel) || null}
                onClose={() => setGeometryOpen(false)}
                onSave={v => setGeometry(v)}
            />
        </>
    );
};
