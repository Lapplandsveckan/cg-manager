import { Button, Card, Stack, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import { SlotErrorBoundary } from '@web-lib';
import { RouteSourceTypePicker } from './components/RouteSourceTypePicker';
import { RouteCard } from './components/RouteCard';
import { useRouteToggle } from './hooks/useRouteToggle';
import { useRoutesQuery } from './query';
import { openRouteInspector } from './inspectorEvents';

const Page = () => {
    const { t } = useTranslation('common');

    const { data: routes, error: routesError } = useRoutesQuery();
    const toggle = useRouteToggle();

    const [picking, setPicking] = useState(false);

    return (
        <>
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
                            onEdit={() =>
                                openRouteInspector({ edit: route.id })
                            }
                            onToggle={next => toggle(route.id, next)}
                            onDelete={() => {
                                openRouteInspector({ delete: route.id });
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
                    openRouteInspector({ create: type });
                }}
            />
        </>
    );
};

export const meta = { label: 'nav.routes', icon: HubOutlinedIcon };

export default Page;
