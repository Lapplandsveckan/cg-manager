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
import {useTranslation} from 'react-i18next';

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
    const {t} = useTranslation();

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
            title: title.trim() || t('plugins.essentials.toggleVideoRoute.defaultTitle'),
            data: {...(entry.data ?? {}), routeId: routeId || undefined},
        });
    };

    return (
        <Stack spacing={2.5}>
            <Stack spacing={0.5}>
                <Typography variant="h3">{t('plugins.essentials.toggleVideoRoute.title')}</Typography>
                <Typography variant="body2" sx={{color: 'text.secondary'}}>
                    {t('plugins.essentials.toggleVideoRoute.description')}
                </Typography>
            </Stack>

            <TextField
                label={t('plugins.essentials.toggleVideoRoute.titleLabel')}
                value={title}
                onChange={e => setTitle(e.target.value)}
                size="small"
                fullWidth
            />

            <FormControl size="small" fullWidth>
                <InputLabel id="essentials-toggle-route-select">
                    {t('plugins.essentials.toggleVideoRoute.routeLabel')}
                </InputLabel>
                <Select
                    labelId="essentials-toggle-route-select"
                    label={t('plugins.essentials.toggleVideoRoute.routeLabel')}
                    value={routes ? routeId : ''}
                    onChange={e => setRouteId(String(e.target.value))}
                    displayEmpty
                >
                    <MenuItem value="">
                        <em>{routes === null ? t('actions.loading') : t('plugins.essentials.toggleVideoRoute.selectRoute')}</em>
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
                    {t('plugins.essentials.toggleVideoRoute.routeGone', {id: routeId})}
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
