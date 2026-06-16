import { Button, Card, Stack, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { useCallback, useEffect, useState } from 'react';
import { noTryAsync } from 'no-try';
import { useTranslation } from 'next-i18next';
import type { VideoRoute } from '../../lib/api/videoRoutes';
import {
    RouteSourceTypePicker,
    type SourceType,
} from '../../components/routes/RouteSourceTypePicker';
import { RouteModal } from '../../components/routes/RouteModal';
import { useSocket } from '../../lib/hooks/useSocket';
import { DefaultContentLayout } from '../../components/DefaultContentLayout';
import { RouteCard } from '../../components/routes/RouteCard';
import { DeleteRouteModal } from '../../components/routes/DeleteRouteModal';
import { useToast } from '../../components/ToastProvider';

const Page = () => {
    const { t } = useTranslation('common');
    const socket = useSocket();
    const notify = useToast();

    const [routes, setRoutes] = useState<VideoRoute[] | null>(null);
    const [channels, setChannels] = useState<number[]>([]);
    const [videoModes, setVideoModes] = useState<string[]>([]);
    const [channelSizes, setChannelSizes] = useState<
        Record<number, { width: number; height: number }>
    >({});
    const [deleting, setDeleting] = useState<VideoRoute | null>(null);
    const [busy, setBusy] = useState(false);

    const [picking, setPicking] = useState(false);
    const [editing, setEditing] = useState<VideoRoute | null>(null);
    const [newType, setNewType] = useState<SourceType | null>(null);

    const refresh = useCallback(() => {
        if (!socket) return;
        socket.videoRoutes
            .list()
            .then(setRoutes)
            .catch(e =>
                notify(
                    (e as Error)?.message ?? t('videoRoutes.errors.loadFailed'),
                    'error',
                ),
            );
    }, [socket]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    useEffect(() => {
        if (!socket) return;

        const createListener = {
            path: 'routes',
            method: 'CREATE',
            handler: (req: any) => {
                const route = req.getData() as VideoRoute;
                if (!route?.id) return;
                setRoutes(prev =>
                    prev
                        ? prev.some(r => r.id === route.id)
                            ? prev
                            : [...prev, route]
                        : [route],
                );
            },
        };

        const updateListener = {
            path: 'routes',
            method: 'UPDATE',
            handler: (req: any) => {
                const route = req.getData() as VideoRoute;
                if (!route?.id) return;
                setRoutes(
                    prev =>
                        prev?.map(r => (r.id === route.id ? route : r)) ?? prev,
                );
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
        socket.caspar
            .getConfig()
            .then(cfg => {
                if (cancelled) return;
                setChannels(cfg.channels.map((_, i) => i + 1));
                setVideoModes(cfg.videoModes.map(m => m.id).filter(Boolean));
                // Build channelIdx → output WxH for the GeometryEditor stage.
                const sizes: Record<number, { width: number; height: number }> =
                    {};
                for (let i = 0; i < cfg.channels.length; i++) {
                    const mode = cfg.videoModes.find(
                        m => m.id === cfg.channels[i].videoMode,
                    );
                    if (mode)
                        sizes[i + 1] = {
                            width: mode.width,
                            height: mode.height,
                        };
                }
                setChannelSizes(sizes);
            })
            .catch(() => {
                if (cancelled) return;
                setChannels([]);
                setVideoModes([]);
                setChannelSizes({});
            });
        return () => {
            cancelled = true;
        };
    }, [socket]);

    const toggle = useCallback(
        async (id: string, next: boolean) => {
            if (!socket) return;
            setRoutes(
                prev =>
                    prev?.map(r =>
                        r.id === id ? { ...r, enabled: next } : r,
                    ) ?? prev,
            );
            const [err, updated] = await noTryAsync(async () =>
                socket.videoRoutes.setEnabled(id, next),
            );
            if (err) {
                setRoutes(
                    prev =>
                        prev?.map(r =>
                            r.id === id ? { ...r, enabled: !next } : r,
                        ) ?? prev,
                );
                notify(
                    (err as Error)?.message ??
                        t('videoRoutes.errors.toggleFailed'),
                    'error',
                );
                return;
            }

            setRoutes(
                prev => prev?.map(r => (r.id === id ? updated : r)) ?? prev,
            );
        },
        [socket],
    );

    const confirmDelete = async () => {
        if (!socket || !deleting) return;
        setBusy(true);

        const [err] = await noTryAsync(async () =>
            socket.videoRoutes.delete(deleting.id),
        );
        if (err) {
            notify(
                (err as Error)?.message ?? t('videoRoutes.errors.deleteFailed'),
                'error',
            );
        } else {
            setRoutes(prev => prev?.filter(r => r.id !== deleting.id) ?? prev);
            setDeleting(null);
            notify(t('videoRoutes.success.deleted'), 'success');
        }

        setBusy(false);
    };

    const saveRoute = async (data: Omit<VideoRoute, 'id'>) => {
        if (!socket) return;
        const [err] = await noTryAsync(async () => {
            if (editing) {
                const updated = await socket.videoRoutes.update(
                    editing.id,
                    data,
                );
                setRoutes(
                    prev =>
                        prev?.map(r => (r.id === updated.id ? updated : r)) ??
                        prev,
                );
            } else {
                const created = await socket.videoRoutes.create(data);
                setRoutes(prev => {
                    if (!prev) return [created];
                    return prev.some(r => r.id === created.id)
                        ? prev.map(r => (r.id === created.id ? created : r))
                        : [...prev, created];
                });
            }
        });
        if (err) {
            notify(
                (err as Error)?.message ?? t('videoRoutes.errors.saveFailed'),
                'error',
            );
            return;
        }
        notify(t('videoRoutes.success.saved'), 'success');
        setEditing(null);
        setNewType(null);
    };

    const modalOpen = editing !== null || newType !== null;
    const closeModal = () => {
        setEditing(null);
        setNewType(null);
    };

    return (
        <DefaultContentLayout>
            <Stack
                direction="row"
                alignItems="flex-start"
                justifyContent="space-between"
                gap={2}
                mb={4}
            >
                <Stack spacing={1}>
                    <Typography variant="h1">{t('nav.routes')}</Typography>
                    <Typography
                        variant="body1"
                        sx={{ color: 'text.secondary' }}
                    >
                        {t('videoRoutes.description')}
                    </Typography>
                </Stack>
                <Button
                    variant="contained"
                    startIcon={<AddRoundedIcon />}
                    onClick={() => setPicking(true)}
                >
                    {t('videoRoutes.newRoute')}
                </Button>
            </Stack>

            {routes === null && (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {t('actions.loading')}
                </Typography>
            )}

            {routes?.length === 0 && (
                <Card sx={{ p: 3, textAlign: 'center', maxWidth: 720 }}>
                    <Typography
                        variant="body1"
                        sx={{ color: 'text.secondary' }}
                    >
                        {t('videoRoutes.empty.prefix')}{' '}
                        <strong>{t('videoRoutes.newRoute')}</strong>
                        {t('videoRoutes.empty.suffix')}
                    </Typography>
                </Card>
            )}

            <Stack spacing={1.5} sx={{ maxWidth: 820 }}>
                {routes?.map(route => (
                    <RouteCard
                        key={route.id}
                        route={route}
                        onEdit={() => setEditing(route)}
                        onToggle={next => toggle(route.id, next)}
                        onDelete={() => {
                            setDeleting(route);
                        }}
                    />
                ))}
            </Stack>

            <RouteSourceTypePicker
                open={picking}
                onClose={() => setPicking(false)}
                onSelect={type => {
                    setPicking(false);
                    setNewType(type);
                }}
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
                onDelete={
                    editing
                        ? () => {
                              setDeleting(editing);
                          }
                        : undefined
                }
            />

            <DeleteRouteModal
                deleting={deleting}
                busy={busy}
                onClose={() => setDeleting(null)}
                onConfirm={confirmDelete}
            />
        </DefaultContentLayout>
    );
};

export default Page;
