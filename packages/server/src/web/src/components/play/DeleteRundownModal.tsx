import { Button, Card, Stack, Typography, Modal } from '@mui/material';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import React from 'react';
import { useTranslation } from 'next-i18next';
import type { Rundown } from '../../hooks/useRundowns';

interface DeleteRundownModalProps {
    open: boolean;
    rundown: Rundown | null;
    onConfirm: (rundown: Rundown) => void;
    onCancel: () => void;
}

export const DeleteRundownModal: React.FC<DeleteRundownModalProps> = ({
    open,
    rundown,
    onConfirm,
    onCancel,
}) => {
    const { t } = useTranslation('common');

    return (
        <Modal open={open} onClose={onCancel}>
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
                                {t('playPage.deleteDialog.title')}
                            </Typography>
                        </Stack>
                        <Typography
                            variant="body1"
                            sx={{ color: 'text.secondary' }}
                        >
                            <strong style={{ color: 'inherit' }}>
                                {rundown?.name}
                            </strong>{' '}
                            {t('playPage.deleteDialog.bodyAfterName')}
                        </Typography>
                        <Stack
                            direction="row"
                            justifyContent="flex-end"
                            gap={1}
                        >
                            <Button color="inherit" onClick={onCancel}>
                                {t('actions.cancel')}
                            </Button>
                            <Button
                                variant="contained"
                                color="error"
                                onClick={() => {
                                    if (rundown) onConfirm(rundown);
                                }}
                            >
                                {t('actions.delete')}
                            </Button>
                        </Stack>
                    </Stack>
                </Card>
            </Stack>
        </Modal>
    );
};
