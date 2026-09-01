import { Button, Card, Stack, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { useCallback, useState } from 'react';
import { noTryAsync } from 'no-try';
import { useTranslation } from 'react-i18next';
import { RouteSourceTypePicker } from '../../components/routes/RouteSourceTypePicker';
import { DefaultContentLayout } from '../../components/DefaultContentLayout';
import { RouteCard } from '../../components/routes/RouteCard';
import { useRouteInspector } from '../../components/routes/RouteInspectorProvider';
import { useToast } from '../../components/ToastProvider';
import { SlotErrorBoundary } from '../../components/SlotErrorBoundary';
import { liveId, record } from '../../lib/undo/undoStore';
import { routeScope } from '../../lib/undo/tools';
import { runMutation, useMutationSpec } from '../../lib/query/mutations';
import { routeSetEnabled, useRoutesQuery } from '../../lib/query/routes';

const Page = () => {
    const { t } = useTranslation('common');
    const notify = useToast();

    const { data: routes, error: routesError } = useRoutesQuery();
    const setEnabled = useMutationSpec(routeSetEnabled);
    const { editor } = useRouteInspector();

    const [picking, setPicking] = useState(false);

    const setEnabledAsync = setEnabled.mutateAsync;
    const toggle = useCallback(
        async (id: string, next: boolean) => {
            const [err, updated] = await noTryAsync(() =>
                setEnabledAsync({ id, enabled: next }),
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
        [setEnabledAsync, notify, t],
    );

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
                            onEdit={() => editor.setEditing(route)}
                            onToggle={next => toggle(route.id, next)}
                            onDelete={() => {
                                editor.setDeleting(route);
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
                    editor.setNewType(type);
                }}
            />
        </DefaultContentLayout>
    );
};

export default Page;
