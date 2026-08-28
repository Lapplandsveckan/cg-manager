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
import { SlotErrorBoundary } from '../../components/SlotErrorBoundary';
import { liveId, record } from '../../lib/undo/undoStore';
import { omitId, rekeyId, routeScope } from '../../lib/undo/tools';
import {
    mergeRouteInCache,
    removeRouteFromCache,
    useRoutesQuery,
} from '../../lib/query/routes';

const Page = () => {
    const { t } = useTranslation('common');
    const socket = useSocket();
    const notify = useToast();

    const { data: routes, error: routesError } = useRoutesQuery();
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

    useEffect(() => {
        if (!socket) return;
        let cancelled = false;
        socket.caspar
            .getConfig()
            .then(cfg => {
                if (cancelled) return;
                setChannels(cfg.channels.map((_, i) => i + 1));
                setVideoModes(cfg.videoModes.map(m => m.id).filter(Boolean));
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
            const [err, updated] = await noTryAsync(async () =>
                socket.videoRoutes.setEnabled(id, next),
            );
            if (err) {
                notify(
                    (err as Error)?.message ??
                        t('videoRoutes.errors.toggleFailed'),
                    'error',
                );
                return;
            }

            mergeRouteInCache(updated);
            record({
                label: {
                    key: next ? 'routeEnable' : 'routeDisable',
                    params: { name: updated.name },
                },
                scopes: [routeScope(id)],
                prev: !next,
                next,
                apply: async (enabled, { api }) => {
                    const applied = await api.videoRoutes.setEnabled(
                        liveId(id),
                        enabled,
                    );
                    mergeRouteInCache(applied);
                },
            });
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
            removeRouteFromCache(deleting.id);
            const deleted = deleting;
            setDeleting(null);
            notify(t('videoRoutes.success.deleted'), 'success');
            record<VideoRoute | null>({
                label: { key: 'routeDelete', params: { name: deleted.name } },
                scopes: [routeScope(deleted.id)],
                prev: deleted,
                next: null,
                apply: async (route, { api, entry }) => {
                    if (route) {
                        const created = await api.videoRoutes.create(
                            omitId(route),
                        );
                        rekeyId(route.id, created.id, routeScope, entry);
                        mergeRouteInCache(created);
                        return;
                    }
                    const id = liveId(deleted.id);
                    await api.videoRoutes.delete(id);
                    removeRouteFromCache(id);
                },
            });
        }

        setBusy(false);
    };

    const saveRoute = async (data: Omit<VideoRoute, 'id'>) => {
        if (!socket) return;
        const [err] = await noTryAsync(async () => {
            if (editing) {
                const before = editing;
                const updated = await socket.videoRoutes.update(
                    editing.id,
                    data,
                );
                mergeRouteInCache(updated);
                record({
                    label: {
                        key: 'routeUpdate',
                        params: { name: updated.name },
                    },
                    scopes: [routeScope(updated.id)],
                    prev: before,
                    next: updated,
                    apply: async (route, { api }) => {
                        const id = liveId(updated.id);
                        const applied = await api.videoRoutes.update(
                            id,
                            omitId(route),
                        );
                        mergeRouteInCache(applied);
                    },
                });
            } else {
                const created = await socket.videoRoutes.create(data);
                mergeRouteInCache(created);
                record<VideoRoute | null>({
                    label: {
                        key: 'routeCreate',
                        params: { name: created.name },
                    },
                    scopes: [routeScope(created.id)],
                    prev: null,
                    next: created,
                    apply: async (route, { api, entry }) => {
                        if (route) {
                            const recreated = await api.videoRoutes.create(
                                omitId(route),
                            );
                            rekeyId(
                                created.id,
                                recreated.id,
                                routeScope,
                                entry,
                            );
                            mergeRouteInCache(recreated);
                            return;
                        }
                        const id = liveId(created.id);
                        await api.videoRoutes.delete(id);
                        removeRouteFromCache(id);
                    },
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

            {routes === undefined && !routesError && (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {t('actions.loading')}
                </Typography>
            )}

            {routesError && (
                <Typography variant="body2" sx={{ color: 'error.main' }}>
                    {routesError.message || t('videoRoutes.errors.loadFailed')}
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
                    <SlotErrorBoundary
                        key={route.id}
                        label={`route-card:${route.id}`}
                        resetKeys={[route.id]}
                    >
                        <RouteCard
                            route={route}
                            onEdit={() => setEditing(route)}
                            onToggle={next => toggle(route.id, next)}
                            onDelete={() => {
                                setDeleting(route);
                            }}
                        />
                    </SlotErrorBoundary>
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
