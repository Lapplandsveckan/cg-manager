import React, {useEffect, useState} from 'react';
import {Stack, Typography} from '@mui/material';
import {useSocket} from '@web-lib';

interface VideoRoute {
    id: string;
    name: string;
    enabled: boolean;
}

interface Props {
    entry: {
        id: string;
        data?: { routeId?: string };
    };
}

const ToggleVideoRouteItem: React.FC<Props> = ({entry}) => {
    const conn = useSocket();
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
        conn.videoRoutes.get(routeId)
            .then((r: VideoRoute) => {
                if (!mounted) return;
                if (r?.id) { setRoute(r); setMissing(false); }
                else { setRoute(null); setMissing(true); }
            })
            .catch(() => mounted && setMissing(true));

        const updateListener = {
            path: 'routes',
            method: 'UPDATE' as const,
            handler: (req: any) => {
                const data = req.getData();
                if (!data || data.id !== routeId) return;
                setRoute(data as VideoRoute);
                setMissing(false);
            },
        };
        const deleteListener = {
            path: 'routes',
            method: 'DELETE' as const,
            handler: (req: any) => {
                if (req.getData() !== routeId) return;
                setRoute(null);
                setMissing(true);
            },
        };
        conn.routes.register(updateListener);
        conn.routes.register(deleteListener);

        return () => {
            mounted = false;
            conn.routes.unregister(updateListener);
            conn.routes.unregister(deleteListener);
        };
    }, [routeId, conn]);

    if (!routeId) return (
        <Typography variant="body2" sx={{color: 'text.secondary', fontStyle: 'italic'}}>
            No route selected
        </Typography>
    );

    if (missing) return (
        <Typography variant="body2" sx={{color: 'warning.main'}}>
            Route {routeId} not found
        </Typography>
    );

    if (!route) return (
        <Typography variant="body2" sx={{color: 'text.disabled'}}>
            Loading…
        </Typography>
    );

    return (
        <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" sx={{color: 'text.secondary'}}>Toggles:</Typography>
            <Typography variant="body2">{route.name || route.id}</Typography>
            <Typography
                variant="caption"
                sx={{
                    px: 0.75,
                    py: 0.125,
                    borderRadius: 0.75,
                    bgcolor: route.enabled ? 'success.dark' : 'action.disabledBackground',
                    color: route.enabled ? 'success.contrastText' : 'text.secondary',
                    fontFamily: '"SF Mono", "Menlo", "Consolas", monospace',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                }}
            >
                {route.enabled ? 'On' : 'Off'}
            </Typography>
        </Stack>
    );
};

export default ToggleVideoRouteItem;
