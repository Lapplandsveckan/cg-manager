import { Button, Card, Modal, Stack, Typography } from '@mui/material';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { useTranslation } from 'react-i18next';
import type { VideoRoute } from '../api';

interface DeleteRouteModalProps {
    deleting: VideoRoute | null;
    busy: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export const DeleteRouteModal: React.FC<DeleteRouteModalProps> = ({
    deleting,
    busy,
    onClose,
    onConfirm,
}) => {
    const { t } = useTranslation('routes');

    return (
        <Modal open={Boolean(deleting)} onClose={() => !busy && onClose()}>
            <Stack
                justifyContent="center"
                alignItems="center"
                sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                }}
            >
                <Card
                    sx={theme => ({
                        p: 3,
                        width: 460,
                        bgcolor: theme.palette.surface.elevated,
                        border: `1px solid ${theme.palette.divider}`,
                    })}
                >
                    <Stack spacing={2}>
                        <Stack direction="row" alignItems="center" gap={1.5}>
                            <WarningAmberRoundedIcon
                                sx={{ color: '#e88c8c' }}
                            />
                            <Typography variant="h3">
                                {t('deleteConfirm.title')}
                            </Typography>
                        </Stack>
                        <Typography
                            variant="body1"
                            sx={{ color: 'text.secondary' }}
                        >
                            <strong style={{ color: 'inherit' }}>
                                {deleting?.name || deleting?.id}
                            </strong>{' '}
                            {t('deleteConfirm.body')}
                        </Typography>
                        <Stack
                            direction="row"
                            justifyContent="flex-end"
                            gap={1}
                        >
                            <Button
                                onClick={onClose}
                                disabled={busy}
                                color="inherit"
                            >
                                {t('common:actions.cancel')}
                            </Button>
                            <Button
                                onClick={onConfirm}
                                disabled={busy}
                                variant="contained"
                                color="error"
                            >
                                {busy
                                    ? t('deleting')
                                    : t('common:actions.delete')}
                            </Button>
                        </Stack>
                    </Stack>
                </Card>
            </Stack>
        </Modal>
    );
};
