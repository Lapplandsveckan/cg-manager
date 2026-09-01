import React from 'react';
import {
    Button,
    Divider,
    Stack,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
    alpha,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { type ConfigMode } from '../../lib/config/useConfigMode';

interface ConfigHeaderProps {
    dirty: boolean;
    saving: boolean;
    mode: ConfigMode;
    onSave: () => void;
    onDiscard: () => void;
    onModeChange: (mode: ConfigMode) => void;
}

const ModeToggle: React.FC<{
    mode: ConfigMode;
    onChange: (mode: ConfigMode) => void;
}> = ({ mode, onChange }) => {
    const { t } = useTranslation('common');
    return (
        <ToggleButtonGroup
            exclusive
            value={mode}
            onChange={(_, next: ConfigMode | null) => {
                if (next !== null) onChange(next);
            }}
            size="small"
            aria-label={t('config.mode.label')}
            sx={theme => ({
                '& .MuiToggleButton-root': {
                    px: 1.25,
                    py: 0.5,
                    textTransform: 'none',
                    color: 'text.secondary',
                    borderColor: theme.palette.divider,
                    '&.Mui-selected': {
                        color: theme.palette.primary.main,
                        bgcolor: alpha(theme.palette.primary.main, 0.14),
                        '&:hover': {
                            bgcolor: alpha(theme.palette.primary.main, 0.22),
                        },
                    },
                    '&:not(.Mui-selected):hover': {
                        color: theme.palette.primary.main,
                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                    },
                },
            })}
        >
            <ToggleButton value="simple">
                {t('config.mode.simple')}
            </ToggleButton>
            <ToggleButton value="advanced">
                {t('config.mode.advanced')}
            </ToggleButton>
        </ToggleButtonGroup>
    );
};

export const ConfigHeader: React.FC<ConfigHeaderProps> = ({
    dirty,
    saving,
    mode,
    onSave,
    onDiscard,
    onModeChange,
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
            <Stack direction="row" alignItems="center" gap={1.5}>
                <ModeToggle mode={mode} onChange={onModeChange} />
                <Divider orientation="vertical" flexItem />
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
        </Stack>
    );
};
