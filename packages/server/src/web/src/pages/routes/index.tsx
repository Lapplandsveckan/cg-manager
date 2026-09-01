import { Button, Card, Stack, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { useCallback, useState } from 'react';
import { noTryAsync } from 'no-try';
import { useTranslation } from 'react-i18next';
import type { VideoRoute } from '../../lib/api/videoRoutes';
import {
    RouteSourceTypePicker,
    type SourceType,
} from '../../components/routes/RouteSourceTypePicker';
import { RouteModal } from '../../components/routes/RouteModal';
import { DefaultContentLayout } from '../../components/DefaultContentLayout';
import { RouteCard } from '../../components/routes/RouteCard';
import { DeleteRouteModal } from '../../components/routes/DeleteRouteModal';
import { useToast } from '../../components/ToastProvider';
import { SlotErrorBoundary } from '../../components/SlotErrorBoundary';
import { liveId, record } from '../../lib/undo/undoStore';
import { omitId, rekeyId, routeScope } from '../../lib/undo/tools';
import { runMutation, useMutationSpec } from '../../lib/query/mutations';
import {
    routeCreate,
    routeDelete,
    routeSetEnabled,
    routeUpdate,
    useRoutesQuery,
} from '../../lib/query/routes';
import { useChannelInfo } from '../../lib/query/caspar';

const Page = () => {
    const { t } = useTranslation('common');
    const notify = useToast();

    const { data: routes, error: routesError } = useRoutesQuery();
    const { channels, videoModes, channelSizes } = useChannelInfo();
    const setEnabled = useMutationSpec(routeSetEnabled);
    const create = useMutationSpec(routeCreate);
    const update = useMutationSpec(routeUpdate);
    const deleteMut = useMutationSpec(routeDelete);
    const [deleting, setDeleting] = useState<VideoRoute | null>(null);

    const [picking, setPicking] = useState(false);
    const [editing, setEditing] = useState<VideoRoute | null>(null);
    const [newType, setNewType] = useState<SourceType | null>(null);

    const toggle = useCallback(
        async (id: string, next: boolean) => {
            const [err, updated] = await noTryAsync(() =>
                setEnabled.mutateAsync({ id, enabled: next }),
            );
            if (err) {
                notify(
                    (err as Error)?.message ??
                        t('videoRoutes.errors.toggleFailed'),
                    'error',
                );
                return;
            }

            record({
                label: {
                    key: next ? 'routeEnable' : 'routeDisable',
                    params: { name: updated.name },
                },
                scopes: [routeScope(id)],
                prev: !next,
                next,
                apply: (enabled, { api }) =>
                    runMutation(routeSetEnabled, api, {
                        id: liveId(id),
                        enabled,
                    }),
            });
        },
        [setEnabled.mutateAsync],
    );

    const confirmDelete = async () => {
        if (!deleting) return;

        const [err] = await noTryAsync(() =>
            deleteMut.mutateAsync({ id: deleting.id }),
        );
        if (err) {
            notify(
                (err as Error)?.message ?? t('videoRoutes.errors.deleteFailed'),
                'error',
            );
        } else {
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
                        const created = await runMutation(
                            routeCreate,
                            api,
                            omitId(route),
                        );
                        rekeyId(route.id, created.id, routeScope, entry);
                        return;
                    }
                    await runMutation(routeDelete, api, {
                        id: liveId(deleted.id),
                    });
                },
            });
        }
    };

    const saveRoute = async (data: Omit<VideoRoute, 'id'>) => {
        const [err] = await noTryAsync(async () => {
            if (editing) {
                const before = editing;
                const updated = await update.mutateAsync({
                    id: editing.id,
                    data,
                });
                record({
                    label: {
                        key: 'routeUpdate',
                        params: { name: updated.name },
                    },
                    scopes: [routeScope(updated.id)],
                    prev: before,
                    next: updated,
                    apply: (route, { api }) =>
                        runMutation(routeUpdate, api, {
                            id: liveId(updated.id),
                            data: omitId(route),
                        }),
                });
            } else {
                const created = await create.mutateAsync(data);
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
                            const recreated = await runMutation(
                                routeCreate,
                                api,
                                omitId(route),
                            );
                            rekeyId(
                                created.id,
                                recreated.id,
                                routeScope,
                                entry,
                            );
                            return;
                        }
                        await runMutation(routeDelete, api, {
                            id: liveId(created.id),
                        });
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
                busy={deleteMut.isPending}
                onClose={() => setDeleting(null)}
                onConfirm={confirmDelete}
            />
        </DefaultContentLayout>
    );
};

export default Page;
