import {Button, Stack, Typography} from '@mui/material';
import React, {useEffect, useState} from 'react';
import {useSocket} from '../../lib';
import {DefaultContentLayout} from '../../components/DefaultContentLayout';

export interface VideoRoute {
    id: string;
    name: string;
    enabled: boolean;
}

interface VideoRouteProps {
    id: string;
    name: string;
    enabled: boolean;

    onEnabled: (enabled: boolean) => void;
}


function useRoutes() {
    const conn = useSocket();
    const [routes, setRoutes] = useState<VideoRoute[]>([]);

    useEffect(() => {
        conn.rawRequest('/api/routes', 'GET', {}).then(rundowns => setRoutes(rundowns.data ?? []));

        const updateListener = {
            path: 'route',
            method: 'UPDATE',

            handler: request =>
                setRoutes(rundowns =>
                    rundowns.map(v => v.id === request.data.id ? request.data : v),
                ),
        };

        conn.routes.register(updateListener);
        return () => conn.routes.unregister(updateListener);
    }, []);


    const setRouteEnabled = (id: string, enabled: boolean) => {
        conn.rawRequest(`/api/routes/${id}`, 'UPDATE', { enabled });
        setRoutes(routes.map(v => v.id === id ? {...v, enabled} : v));
    };

    return {
        routes,
        setRouteEnabled,
    };
}


const Route: React.FC<VideoRouteProps> = ({id, name, enabled, onEnabled}) => {
    return (
        <Stack
            padding={2}
            direction="column"
            sx={{
                backgroundColor: '#272930',
                borderRadius: 4,
                width: '500px',
                cursor: 'pointer',
            }}
        >
            <Stack
                direction="row"
                justifyContent={'space-between'}
            >
                <Typography variant="h6">
                    {name ?? id}
                </Typography>
                <Typography variant="h6" color={enabled ? 'success' : 'error'}>
                    {enabled ? 'Enabled' : 'Disabled'}
                </Typography>
                <Button
                    onClick={e => {
                        e.stopPropagation();
                        onEnabled(!enabled);
                    }}
                >
                    Toggle Enabled
                </Button>
            </Stack>
        </Stack>
    );
};

const Page = () => {
    const {
        routes,
        setRouteEnabled,
    } = useRoutes();

    return (
        <DefaultContentLayout>
            <h1>Video Routes</h1>

            <Stack
                spacing={3}
            >
                {routes.map(entry => (
                    <Route
                        key={entry.id}
                        onEnabled={enabled => setRouteEnabled(entry.id, enabled)}

                        {...entry}
                    />
                ))}
            </Stack>
        </DefaultContentLayout>
    );
};

export default Page;
