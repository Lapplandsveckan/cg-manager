import React from 'react';
import { MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useIngestSessions, useShareLinks } from './data';

interface RouteSourceProps {
    data: Record<string, unknown>;
    onChange: (data: Record<string, unknown>) => void;
}

/** Rendered inside the routes plugin's source editor (zone
 *  `plugin:routes.source.screenshare`). A route picks a share link rather than
 *  a session, so it keeps working across reconnects. */
const ScreenshareRouteSource: React.FC<RouteSourceProps> = ({
    data,
    onChange,
}) => {
    const { t } = useTranslation('screenshare');
    const { shares, loading } = useShareLinks();
    const { sessions } = useIngestSessions();

    const shareId = typeof data.shareId === 'string' ? data.shareId : '';
    const connected = (id: string) =>
        sessions.some(session => session.shareId === id);
    const missing =
        !!shareId && !loading && !shares.some(s => s.id === shareId);

    return (
        <Stack spacing={1}>
            <TextField
                select
                fullWidth
                size="small"
                label={t('routeSource.share')}
                helperText={t('routeSource.shareHint')}
                value={shares.some(s => s.id === shareId) ? shareId : ''}
                onChange={e => onChange({ ...data, shareId: e.target.value })}
            >
                {shares.map(share => (
                    <MenuItem key={share.id} value={share.id}>
                        {share.label}
                        {connected(share.id)
                            ? ` · ${t('sessions.state.live')}`
                            : ''}
                    </MenuItem>
                ))}
            </TextField>

            {!loading && !shares.length && (
                <Typography variant="caption" color="text.secondary">
                    {t('routeSource.noShares')}
                </Typography>
            )}

            {missing && (
                <Typography variant="caption" color="warning.main">
                    {t('routeSource.shareGone')}
                </Typography>
            )}
        </Stack>
    );
};

export default ScreenshareRouteSource;
