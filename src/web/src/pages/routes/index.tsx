import {DefaultContentLayout} from '../../components/DefaultContentLayout';
import {useSocket} from '../../lib/hooks/useSocket';
import {Box, Button, Card, IconButton, Modal, Stack, Switch, Tooltip, Typography, alpha} from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import {useCallback, useEffect, useState} from 'react';
import {VideoRoute, VideoRouteSource, VideoRouteDestination} from '../../lib/api/videoRoutes';

function summariseSource(source: VideoRouteSource): string {
    switch (source.type) {
        case 'decklink':
            return source.keyDevice !== undefined
                ? `Decklink #${source.device} (+key #${source.keyDevice})`
                : `Decklink #${source.device}`;
        case 'video':
            return `Video: ${source.video}`;
        case 'channel':
            return `Channel ${source.channel}`;
        case 'color':
            return `Color ${source.color}`;
    }
}

function summariseDestination(destination: VideoRouteDestination): string {
    const idx = destination.index !== undefined ? ` [${destination.index}]` : '';
    return `${destination.effectLayer}${idx}`;
}

const StatusPill: React.FC<{ enabled: boolean }> = ({ enabled }) => {
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
                {enabled ? 'Active' : 'Disabled'}
            </Typography>
        </Stack>
    );
};

interface RouteCardProps {
    route: VideoRoute;
    onToggle: (next: boolean) => void;
    onDelete: () => void;
}

const RouteCard: React.FC<RouteCardProps> = ({ route, onToggle, onDelete }) => {
    return (
        <Card sx={{ p: 2.5 }}>
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={2}>
                <Stack spacing={0.75} sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Stack direction="row" alignItems="center" gap={1.25}>
                        <Typography variant="h4" sx={{ wordBreak: 'break-word' }}>
                            {route.name || '(unnamed route)'}
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
                            {summariseSource(route.source)}
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

                <Stack direction="row" alignItems="center" gap={0.5} sx={{ flexShrink: 0 }}>
                    <Switch
                        color="primary"
                        checked={route.enabled}
                        onChange={(_, checked) => onToggle(checked)}
                        inputProps={{ 'aria-label': `Toggle ${route.name}` }}
                    />
                    <Tooltip title="Delete">
                        <IconButton size="small" onClick={onDelete} sx={{ color: '#e88c8c' }}>
                            <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Stack>
            </Stack>
        </Card>
    );
};

const Page = () => {
    const socket = useSocket();

    const [routes, setRoutes] = useState<VideoRoute[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<VideoRoute | null>(null);
    const [busy, setBusy] = useState(false);

    const refresh = useCallback(() => {
        if (!socket) return;
        socket.videoRoutes.list()
            .then(setRoutes)
            .catch(e => setError((e as Error)?.message ?? 'Failed to load routes'));
    }, [socket]);

    useEffect(() => { refresh(); }, [refresh]);

    const toggle = useCallback(async (id: string, next: boolean) => {
        if (!socket) return;
        setRoutes(prev => prev?.map(r => r.id === id ? { ...r, enabled: next } : r) ?? prev);
        try {
            const updated = await socket.videoRoutes.setEnabled(id, next);
            setRoutes(prev => prev?.map(r => r.id === id ? updated : r) ?? prev);
        } catch (e) {
            // Revert on failure
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

    return (
        <DefaultContentLayout>
            <Stack spacing={1} mb={4}>
                <Typography variant="h1">Routes</Typography>
                <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                    Live video routes from sources (decklink inputs, files, channels, colors) to
                    effect groups on CasparCG channels. Toggle to activate or pause; delete to
                    remove.
                </Typography>
            </Stack>

            {error && (
                <Card sx={(theme) => ({ p: 2, mb: 2, borderColor: theme.palette.error.main })}>
                    <Typography variant="body2" color="error">{error}</Typography>
                </Card>
            )}

            {routes === null && !error && (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>Loading…</Typography>
            )}

            {routes?.length === 0 && (
                <Card sx={{ p: 3, textAlign: 'center', maxWidth: 720 }}>
                    <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                        No video routes yet. Drop a JSON file in the configured
                        <Box component="span" sx={{ fontFamily: '"SF Mono", monospace', mx: 0.5 }}>
                            routes-dir
                        </Box>
                        and restart the manager.
                    </Typography>
                </Card>
            )}

            <Stack spacing={1.5} sx={{ maxWidth: 820 }}>
                {routes?.map(route => (
                    <RouteCard
                        key={route.id}
                        route={route}
                        onToggle={(next) => toggle(route.id, next)}
                        onDelete={() => { setError(null); setDeleting(route); }}
                    />
                ))}
            </Stack>

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
                                <Typography variant="h3">Delete video route?</Typography>
                            </Stack>
                            <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                                <strong style={{ color: 'inherit' }}>{deleting?.name || deleting?.id}</strong> will
                                be removed and its underlying effect torn down. The JSON file in
                                <Box component="span" sx={{ fontFamily: '"SF Mono", monospace', mx: 0.5 }}>
                                    routes-dir
                                </Box>
                                will be deleted from disk. This can&apos;t be undone.
                            </Typography>
                            {error && <Typography variant="body2" color="error">{error}</Typography>}
                            <Stack direction="row" justifyContent="flex-end" gap={1}>
                                <Button onClick={() => setDeleting(null)} disabled={busy} color="inherit">
                                    Cancel
                                </Button>
                                <Button onClick={confirmDelete} disabled={busy} variant="contained" color="error">
                                    {busy ? 'Deleting…' : 'Delete'}
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
