import React from 'react';
import {Stack, Typography, CircularProgress} from '@mui/material';
import WifiOffRoundedIcon from '@mui/icons-material/WifiOffRounded';
import {useTranslation} from 'next-i18next';
import {useConnection} from './ConnectionProvider';

export const ConnectionBanner: React.FC = () => {
    const {t} = useTranslation('common');
    const {state} = useConnection();

    if (state === 'connected') return null;

    const disconnected = state === 'disconnected';

    return (
        <Stack
            direction="row"
            alignItems="center"
            gap={1}
            sx={(theme) => ({
                bgcolor: disconnected ? theme.palette.error.dark : theme.palette.warning.dark,
                color: theme.palette.common.white,
                px: 2,
                py: 0.75,
                flexShrink: 0,
                borderBottom: `1px solid ${theme.palette.common.black}`,
            })}
            role="status"
            aria-live="polite"
        >
            {disconnected
                ? <WifiOffRoundedIcon fontSize="small" />
                : <CircularProgress size={14} sx={{color: 'inherit'}} />}
            <Typography variant="body2" sx={{fontWeight: 500}}>
                {disconnected
                    ? t('connection.banner.disconnected')
                    : t('connection.banner.reconnecting')}
            </Typography>
        </Stack>
    );
};
