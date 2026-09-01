import React, { useState } from 'react';
import {
    Alert,
    Button,
    CircularProgress,
    Stack,
    Typography,
} from '@mui/material';
import { useTranslation } from 'next-i18next/pages';
import { noTryAsync } from 'no-try';
import { useSocket } from '../../lib/hooks/useSocket';

interface ConfigStatusProps {
    drift: boolean;
    error: string | null;
    loading: boolean;
}

export const ConfigStatus: React.FC<ConfigStatusProps> = ({
    drift,
    error,
    loading,
}) => {
    const { t } = useTranslation('common');
    const socket = useSocket();
    const [restarting, setRestarting] = useState(false);

    const restart = async () => {
        setRestarting(true);
        await noTryAsync(() => socket.caspar.restart());
        setRestarting(false);
    };

    return (
        <>
            {drift ? (
                <Alert
                    severity="warning"
                    variant="outlined"
                    action={
                        <Button
                            size="small"
                            color="inherit"
                            disabled={restarting}
                            onClick={restart}
                        >
                            {restarting
                                ? t('config.restarting')
                                : t('config.restartNow')}
                        </Button>
                    }
                >
                    {t('config.driftMessage')}
                </Alert>
            ) : (
                <Alert severity="info" variant="outlined">
                    {t('config.saveInfoBefore')}
                    <code>casparcg.config</code>
                    {t('config.saveInfoAfter')}
                </Alert>
            )}

            {error && (
                <Alert severity="error" variant="outlined">
                    {error}
                </Alert>
            )}

            {loading && (
                <Stack direction="row" alignItems="center" gap={2}>
                    <CircularProgress size={20} />
                    <Typography
                        variant="body2"
                        sx={{ color: 'text.secondary' }}
                    >
                        {t('config.loading')}
                    </Typography>
                </Stack>
            )}
        </>
    );
};
