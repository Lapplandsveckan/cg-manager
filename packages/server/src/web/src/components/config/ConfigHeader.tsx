import React from 'react';
import { Button, Stack, Typography } from '@mui/material';
import { useTranslation } from 'next-i18next/pages';

interface ConfigHeaderProps {
    dirty: boolean;
    saving: boolean;
    onSave: () => void;
    onDiscard: () => void;
}

export const ConfigHeader: React.FC<ConfigHeaderProps> = ({
    dirty,
    saving,
    onSave,
    onDiscard,
}) => {
    const { t } = useTranslation('common');
    return (
        <Stack
            direction="row"
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
            gap={2}
            flexWrap="wrap"
        >
            <Stack spacing={1}>
                <Typography variant="h1">{t('nav.config')}</Typography>
                <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                    {t('config.subtitle')}
                </Typography>
            </Stack>
            <Stack direction="row" gap={1}>
                <Button
                    onClick={onDiscard}
                    disabled={!dirty || saving}
                    color="inherit"
                >
                    {t('config.discard')}
                </Button>
                <Button
                    onClick={onSave}
                    disabled={!dirty || saving}
                    variant="contained"
                >
                    {saving ? t('config.saving') : t('actions.save')}
                </Button>
            </Stack>
        </Stack>
    );
};
