import {Box, Button, Card, CardActionArea, IconButton, Modal, Stack, Switch, Tooltip, Typography, alpha} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import {useCallback, useEffect, useState} from 'react';
import {useTranslation} from 'next-i18next';
import {type VideoRoute, type VideoRouteSource, type VideoRouteDestination} from '../../lib/api/videoRoutes';
import {RouteSourceTypePicker, type SourceType} from '../../components/routes/RouteSourceTypePicker';
import {RouteModal} from '../../components/routes/RouteModal';
import {useSocket} from '../../lib/hooks/useSocket';
import {DefaultContentLayout} from '../../components/DefaultContentLayout';

type Translate = (key: string, options?: Record<string, unknown>) => string;

function summariseSource(t: Translate, source: VideoRouteSource): string {
    switch (source.type) {
        case 'decklink':
            return source.keyDevice !== undefined
                ? t('videoRoutes.summary.decklinkWithKey', {device: source.device, key: source.keyDevice})
                : t('videoRoutes.summary.decklink', {device: source.device});
        case 'video':
            return t('videoRoutes.summary.video', {video: source.video});
        case 'channel':
            return t('videoRoutes.summary.channel', {channel: source.channel});
        case 'color':
            return t('videoRoutes.summary.color', {color: source.color});
    }
}

function summariseDestination(destination: VideoRouteDestination): string {
    const idx = destination.index !== undefined ? ` [${destination.index}]` : '';
    return `${destination.effectLayer}${idx}`;
}

const StatusPill: React.FC<{ enabled: boolean }> = ({ enabled }) => {
    const {t} = useTranslation('common');
    const color = enabled ? '#5fc97a' : 'rgba(232, 234, 237, 0.4)';
    return (
        <Stack
            direction="row"
            alignItems="center"
            gap={0.75}
            sx={(theme) => ({
                px: 1,
                py: 0.25,
                borderRadius: 1,
                bgcolor: enabled ? alpha('#5fc97a', 0.1) : alpha(theme.palette.text.primary, 0.04),
                border: `1px solid ${enabled ? alpha('#5fc97a', 0.3) : theme.palette.divider}`,
            })}
        >
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: color }} />
            <Typography variant="caption" sx={{ color: enabled ? '#5fc97a' : 'text.secondary' }}>
                {enabled ? t('videoRoutes.status.active') : t('videoRoutes.status.disabled')}
            </Typography>
        </Stack>
    );
};

interface RouteCardProps {
    route: VideoRoute;
    onEdit: () => void;
    onToggle: (next: boolean) => void;
    onDelete: () => void;
}

const RouteCard: React.FC<RouteCardProps> = ({ route, onEdit, onToggle, onDelete }) => {
    const {t} = useTranslation('common');
    // CardActionArea wraps the whole card so clicking anywhere opens the
    // editor — except for the inline controls (Switch / Delete) which stop
    // propagation so they don't double-fire as "edit this".
    const stop = (e: React.MouseEvent | React.SyntheticEvent) => e.stopPropagation();

    return (
        <Card sx={{ p: 0 }}>
            <CardActionArea onClick={onEdit} sx={{ p: 2.5, alignItems: 'stretch' }}>
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={2}>
                    <Stack spacing={0.75} sx={{ minWidth: 0, flexGrow: 1 }}>
                        <Stack direction="row" alignItems="center" gap={1.25}>
                            <Typography variant="h4" sx={{ wordBreak: 'break-word' }}>
                                {route.name || t('videoRoutes.unnamed')}
                            </Typography>
                            <StatusPill enabled={route.enabled} />
                        </Stack>
                        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                            <Typography
                                variant="body2"
                                sx={(theme) => ({
                                    fontFamily: '"SF Mono", "Menlo", "Consolas", monospace',
                                    color: theme.palette.text.secondary,
                                    wordBreak: 'break-word',
                                })}
                            >
                                {summariseSource(t, route.source)}
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.disabled' }}>→</Typography>
                            <Typography
                                variant="body2"
                                sx={(theme) => ({
                                    fontFamily: '"SF Mono", "Menlo", "Consolas", monospace',
                                    color: theme.palette.text.secondary,
                                    wordBreak: 'break-word',
                                })}
                            >
                                {summariseDestination(route.destination)}
                            </Typography>
                        </Stack>
                    </Stack>

                    <Stack
                        direction="row"
                        alignItems="center"
                        gap={0.5}
                        sx={{ flexShrink: 0 }}
                        onClick={stop}
                        onMouseDown={stop}
                    >
                        <Switch
                            color="primary"
                            checked={route.enabled}
                            onChange={(_, checked) => onToggle(checked)}
                            onClick={stop}
                            inputProps={{ 'aria-label': t('videoRoutes.toggleAria', {name: route.name}) }}
                        />
                        <Tooltip title={t('actions.delete')}>
                            <IconButton
                                size="small"
                                onClick={(e) => { stop(e); onDelete(); }}
                                sx={{ color: '#e88c8c' }}
                            >
                                <DeleteOutlineRoundedIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                </Stack>
            </CardActionArea>
        </Card>
    );
};

const Page = () => {
    const {t} = useTranslation('common');
    const socket = useSocket();

    const [routes, setRoutes] = useState<VideoRoute[] | null>(null);
    const [channels, setChannels] = useState<number[]>([]);
    const [videoModes, setVideoModes] = useState<string[]>([]);
    const [channelSizes, setChannelSizes] = useState<Record<number, {width: number; height: number}>>({});
    const [error, setError] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<VideoRoute | null>(null);
    const [busy, setBusy] = useState(false);

    const [picking, setPicking] = useState(false);
    const [editing, setEditing] = useState<VideoRoute | null>(null);
    const [newType, setNewType] = useState<SourceType | null>(null);

    const refresh = useCallback(() => {
        if (!socket) return;
        socket.videoRoutes.list()
            .then(setRoutes)
            .catch(e => setError((e as Error)?.message ?? 'Failed to load routes'));
    }, [socket]);

    useEffect(() => { refresh(); }, [refresh]);

    useEffect(() => {
        if (!socket) return;

        const createListener = {
            path: 'routes',
            method: 'CREATE',
            handler: (req: any) => {
                const route = req.getData() as VideoRoute;
                if (!route?.id) return;
                setRoutes(prev => prev
                    ? (prev.some(r => r.id === route.id) ? prev : [...prev, route])
                    : [route]);
            },
        };

        const updateListener = {
            path: 'routes',
            method: 'UPDATE',
            handler: (req: any) => {
                const route = req.getData() as VideoRoute;
                if (!route?.id) return;
                setRoutes(prev => prev?.map(r => r.id === route.id ? route : r) ?? prev);
            },
        };

        const deleteListener = {
            path: 'routes',
            method: 'DELETE',
            handler: (req: any) => {
                const id = req.getData();
                if (typeof id !== 'string') return;
                setRoutes(prev => prev?.filter(r => r.id !== id) ?? prev);
            },
        };

        socket.routes.register(createListener);
        socket.routes.register(updateListener);
        socket.routes.register(deleteListener);

        return () => {
            socket.routes.unregister(createListener);
            socket.routes.unregister(updateListener);
            socket.routes.unregister(deleteListener);
        };
    }, [socket]);

    useEffect(() => {
        if (!socket) return;
        let cancelled = false;
        // Populate the channel dropdown(s) in the modal. Falls back to an
        // empty list if the CG config can't be read — the modal allows the
        // current draft channel through anyway.
        socket.caspar.getConfig()
            .then((cfg) => {
                if (cancelled) return;
                setChannels(cfg.channels.map((_, i) => i + 1));
                setVideoModes(cfg.videoModes.map((m) => m.id).filter(Boolean));
                // Build channelIdx → output WxH for the GeometryEditor stage.
                const sizes: Record<number, {width: number; height: number}> = {};
                for (let i = 0; i < cfg.channels.length; i++) {
                    const mode = cfg.videoModes.find((m) => m.id === cfg.channels[i].videoMode);
                    if (mode) sizes[i + 1] = {width: mode.width, height: mode.height};
                }
                setChannelSizes(sizes);
            })
            .catch(() => {
                if (cancelled) return;
                setChannels([]);
                setVideoModes([]);
                setChannelSizes({});
            });
        return () => { cancelled = true; };
    }, [socket]);

    const toggle = useCallback(async (id: string, next: boolean) => {
        if (!socket) return;
        setRoutes(prev => prev?.map(r => r.id === id ? { ...r, enabled: next } : r) ?? prev);
        try {
            const updated = await socket.videoRoutes.setEnabled(id, next);
            setRoutes(prev => prev?.map(r => r.id === id ? updated : r) ?? prev);
        } catch (e) {
            setRoutes(prev => prev?.map(r => r.id === id ? { ...r, enabled: !next } : r) ?? prev);
            setError((e as Error)?.message ?? 'Failed to toggle route');
        }
    }, [socket]);

    const confirmDelete = async () => {
        if (!socket || !deleting) return;
        setBusy(true);
        setError(null);
        try {
            await socket.videoRoutes.delete(deleting.id);
            setRoutes(prev => prev?.filter(r => r.id !== deleting.id) ?? prev);
            setDeleting(null);
        } catch (e) {
            setError((e as Error)?.message ?? 'Failed to delete route');
        } finally {
            setBusy(false);
        }
    };

    const saveRoute = async (data: Omit<VideoRoute, 'id'>) => {
        if (!socket) return;
        if (editing) {
            const updated = await socket.videoRoutes.update(editing.id, data);
            setRoutes(prev => prev?.map(r => r.id === updated.id ? updated : r) ?? prev);
        } else {
            const created = await socket.videoRoutes.create(data);
            setRoutes(prev => prev ? [...prev, created] : [created]);
        }
        setEditing(null);
        setNewType(null);
    };

    const modalOpen = editing !== null || newType !== null;
    const closeModal = () => { setEditing(null); setNewType(null); };

    return (
        <DefaultContentLayout>
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={2} mb={4}>
                <Stack spacing={1}>
                    <Typography variant="h1">{t('nav.routes')}</Typography>
                    <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                        {t('videoRoutes.description')}
                    </Typography>
                </Stack>
                <Button
                    variant="contained"
                    startIcon={<AddRoundedIcon />}
                    onClick={() => { setError(null); setPicking(true); }}
                >
                    {t('videoRoutes.newRoute')}
                </Button>
            </Stack>

            {error && (
                <Card sx={(theme) => ({ p: 2, mb: 2, borderColor: theme.palette.error.main })}>
                    <Typography variant="body2" color="error">{error}</Typography>
                </Card>
            )}

            {routes === null && !error && (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t('actions.loading')}</Typography>
            )}

            {routes?.length === 0 && (
                <Card sx={{ p: 3, textAlign: 'center', maxWidth: 720 }}>
                    <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                        {t('videoRoutes.empty.prefix')} <strong>{t('videoRoutes.newRoute')}</strong>
                        {t('videoRoutes.empty.suffix')}
                    </Typography>
                </Card>
            )}

            <Stack spacing={1.5} sx={{ maxWidth: 820 }}>
                {routes?.map(route => (
                    <RouteCard
                        key={route.id}
                        route={route}
                        onEdit={() => { setError(null); setEditing(route); }}
                        onToggle={(next) => toggle(route.id, next)}
                        onDelete={() => { setError(null); setDeleting(route); }}
                    />
                ))}
            </Stack>

            <RouteSourceTypePicker
                open={picking}
                onClose={() => setPicking(false)}
                onSelect={(type) => { setPicking(false); setNewType(type); }}
            />

            <RouteModal
                open={modalOpen}
                route={editing}
                newType={newType ?? undefined}
                channels={channels}
                videoModes={videoModes}
                channelSizes={channelSizes}
                onClose={closeModal}
                onSave={saveRoute}
                onDelete={editing ? () => { setDeleting(editing); } : undefined}
            />

            <Modal open={Boolean(deleting)} onClose={() => !busy && setDeleting(null)}>
                <Stack
                    justifyContent="center"
                    alignItems="center"
                    sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                    }}
                >
                    <Card
                        sx={(theme) => ({
                            p: 3,
                            width: 460,
                            bgcolor: theme.palette.surface.elevated,
                            border: `1px solid ${theme.palette.divider}`,
                        })}
                    >
                        <Stack spacing={2}>
                            <Stack direction="row" alignItems="center" gap={1.5}>
                                <WarningAmberRoundedIcon sx={{ color: '#e88c8c' }} />
                                <Typography variant="h3">{t('videoRoutes.deleteConfirm.title')}</Typography>
                            </Stack>
                            <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                                <strong style={{ color: 'inherit' }}>{deleting?.name || deleting?.id}</strong>
                                {' '}{t('videoRoutes.deleteConfirm.body')}
                            </Typography>
                            {error && <Typography variant="body2" color="error">{error}</Typography>}
                            <Stack direction="row" justifyContent="flex-end" gap={1}>
                                <Button onClick={() => setDeleting(null)} disabled={busy} color="inherit">
                                    {t('actions.cancel')}
                                </Button>
                                <Button onClick={confirmDelete} disabled={busy} variant="contained" color="error">
                                    {busy ? t('videoRoutes.deleting') : t('actions.delete')}
                                </Button>
                            </Stack>
                        </Stack>
                    </Card>
                </Stack>
            </Modal>
        </DefaultContentLayout>
    );
};

export default Page;
