import { Box, Stack, Typography, alpha } from '@mui/material';
import { useTranslation } from 'next-i18next';

interface StatusPillProps {
    enabled: boolean;
}

export const StatusPill: React.FC<StatusPillProps> = ({ enabled }) => {
    const { t } = useTranslation('common');
    const color = enabled ? '#5fc97a' : 'rgba(232, 234, 237, 0.4)';
    return (
        <Stack
            direction="row"
            alignItems="center"
            gap={0.75}
            sx={theme => ({
                px: 1,
                py: 0.25,
                borderRadius: 1,
                bgcolor: enabled
                    ? alpha('#5fc97a', 0.1)
                    : alpha(theme.palette.text.primary, 0.04),
                border: `1px solid ${enabled ? alpha('#5fc97a', 0.3) : theme.palette.divider}`,
            })}
        >
            <Box
                sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: color,
                }}
            />
            <Typography
                variant="caption"
                sx={{ color: enabled ? '#5fc97a' : 'text.secondary' }}
            >
                {enabled
                    ? t('videoRoutes.status.active')
                    : t('videoRoutes.status.disabled')}
            </Typography>
        </Stack>
    );
};
