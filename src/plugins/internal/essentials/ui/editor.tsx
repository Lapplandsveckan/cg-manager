import React, {useEffect, useMemo, useState} from 'react';
import {
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import {RundownEditorActionBar, useSocket} from '@web-lib';

interface VideoRoute {
    id: string;
    name: string;
    enabled: boolean;
}

interface Entry {
    id: string;
    title: string;
    type: string;
    data?: { routeId?: string };
}

interface Props {
    entry: Entry;
    creating: boolean;
    updateEntry: (entry: Entry) => void;
    deleteEntry: (entry: Entry) => void;
}

const ToggleVideoRouteEditor: React.FC<Props> = ({entry, creating, updateEntry, deleteEntry}) => {
    const conn = useSocket();

    const [title, setTitle] = useState(entry.title ?? '');
    const [routeId, setRouteId] = useState<string>(entry.data?.routeId ?? '');
    const [routes, setRoutes] = useState<VideoRoute[] | null>(null);

    useEffect(() => {
        let mounted = true;
        conn.videoRoutes.list()
            .then((list: VideoRoute[]) => mounted && setRoutes(list ?? []))
            .catch(() => mounted && setRoutes([]));
        return () => { mounted = false; };
    }, [conn]);

    const selectedExists = useMemo(
        () => !routes || !routeId || routes.some(r => r.id === routeId),
        [routes, routeId],
    );

    const onSave = () => {
        updateEntry({
            ...entry,
            title: title.trim() || 'Toggle video route',
            data: {...(entry.data ?? {}), routeId: routeId || undefined},
        });
    };

    return (
        <Stack spacing={2.5}>
            <Stack spacing={0.5}>
                <Typography variant="h3">Toggle video route</Typography>
                <Typography variant="body2" sx={{color: 'text.secondary'}}>
                    Flips the selected route between enabled and disabled when this
                    item runs.
                </Typography>
            </Stack>

            <TextField
                label="Title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                size="small"
                fullWidth
            />

            <FormControl size="small" fullWidth>
                <InputLabel id="essentials-toggle-route-select">Route</InputLabel>
                <Select
                    labelId="essentials-toggle-route-select"
                    label="Route"
                    value={routes ? routeId : ''}
                    onChange={e => setRouteId(String(e.target.value))}
                    displayEmpty
                >
                    <MenuItem value="">
                        <em>{routes === null ? 'Loading…' : 'Select a route'}</em>
                    </MenuItem>
                    {(routes ?? []).map(r => (
                        <MenuItem key={r.id} value={r.id}>
                            {r.name || r.id}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            {!selectedExists && (
                <Typography variant="caption" sx={{color: 'warning.main'}}>
                    The previously selected route ({routeId}) no longer exists.
                </Typography>
            )}

            <RundownEditorActionBar
                onSave={onSave}
                onDelete={creating ? undefined : () => deleteEntry(entry)}
            />
        </Stack>
    );
};

export default ToggleVideoRouteEditor;
