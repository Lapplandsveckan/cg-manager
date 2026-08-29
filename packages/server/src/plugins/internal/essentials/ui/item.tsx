import React, { useEffect, useState } from 'react';
import { Stack, Typography } from '@mui/material';
import { Method, topic, useBroadcast, useSocket } from '@web-lib';
import { useTranslation } from 'react-i18next';

interface VideoRoute {
    id: string;
    name: string;
    enabled: boolean;
}

const routeUpdated = topic(
    'routes',
    Method.UPDATE,
    (data): data is VideoRoute => typeof (data as VideoRoute)?.id === 'string',
);

const routeDeleted = topic(
    'routes',
    Method.DELETE,
    (data): data is string => typeof data === 'string',
);

interface Props {
    entry: {
        id: string;
        data?: { routeId?: string };
    };
}

const ToggleVideoRouteItem: React.FC<Props> = ({ entry }) => {
    const conn = useSocket();
    const { t } = useTranslation();
    const [route, setRoute] = useState<VideoRoute | null>(null);
    const [missing, setMissing] = useState(false);

    const routeId = entry?.data?.routeId;

    useEffect(() => {
        if (!routeId) {
            setRoute(null);
            setMissing(false);
            return;
        }

        let mounted = true;
        conn.videoRoutes
            .get(routeId)
            .then((r: VideoRoute) => {
                if (!mounted) return;
                if (r?.id) {
                    setRoute(r);
                    setMissing(false);
                } else {
                    setRoute(null);
                    setMissing(true);
                }
            })
            .catch(() => mounted && setMissing(true));

        return () => {
            mounted = false;
        };
    }, [routeId, conn]);

    useBroadcast(routeUpdated, data => {
        if (data.id !== routeId) return;
        setRoute(data);
        setMissing(false);
    });

    useBroadcast(routeDeleted, id => {
        if (id !== routeId) return;
        setRoute(null);
        setMissing(true);
    });

    if (!routeId)
        return (
            <Typography
                variant="body2"
                sx={{ color: 'text.secondary', fontStyle: 'italic' }}
            >
                {t('plugins.essentials.routeItem.noRouteSelected')}
            </Typography>
        );

    if (missing)
        return (
            <Typography variant="body2" sx={{ color: 'warning.main' }}>
                {t('plugins.essentials.routeItem.routeNotFound', {
                    id: routeId,
                })}
            </Typography>
        );

    if (!route)
        return (
            <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                {t('actions.loading')}
            </Typography>
        );

    return (
        <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {t('plugins.essentials.routeItem.toggles')}
            </Typography>
            <Typography variant="body2">{route.name || route.id}</Typography>
            <Typography
                variant="caption"
                sx={{
                    px: 0.75,
                    py: 0.125,
                    borderRadius: 0.75,
                    bgcolor: route.enabled
                        ? 'success.dark'
                        : 'action.disabledBackground',
                    color: route.enabled
                        ? 'success.contrastText'
                        : 'text.secondary',
                    fontFamily: '"SF Mono", "Menlo", "Consolas", monospace',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                }}
            >
                {route.enabled
                    ? t('plugins.essentials.routeItem.on')
                    : t('plugins.essentials.routeItem.off')}
            </Typography>
        </Stack>
    );
};

export default ToggleVideoRouteItem;
