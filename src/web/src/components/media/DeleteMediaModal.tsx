import { Button, Modal, Stack, Typography } from '@mui/material';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import React from 'react';
import { useTranslation } from 'next-i18next';
import { type MediaDoc } from '../../lib/api/caspar';
import ModalCard from './ModalCard';

interface DeleteMediaModalProps {
    open: boolean;
    deleting: MediaDoc | null;
    busy: boolean;
    error: string | null;
    onClose: () => void;
    onConfirm: () => void;
}

const DeleteMediaModal: React.FC<DeleteMediaModalProps> = ({
    open,
    deleting,
    busy,
    error,
    onClose,
    onConfirm,
}) => {
    const { t } = useTranslation('common');

    return (
        <Modal open={open} onClose={() => !busy && onClose()}>
            <ModalCard>
                <Stack spacing={2}>
                    <Stack direction="row" alignItems="center" gap={1.5}>
                        <WarningAmberRoundedIcon sx={{ color: '#e88c8c' }} />
                        <Typography variant="h3">
                            {t('media.deleteMedia.title')}
                        </Typography>
                    </Stack>
                    <Typography
                        variant="body1"
                        sx={{
                            color: 'text.secondary',
                            wordBreak: 'break-all',
                        }}
                    >
                        <strong style={{ color: 'inherit' }}>
                            {deleting?.id}
                        </strong>{' '}
                        {t('media.deleteMedia.body')}
                    </Typography>
                    {error && (
                        <Typography variant="body2" color="error">
                            {error}
                        </Typography>
                    )}
                    <Stack direction="row" justifyContent="flex-end" gap={1}>
                        <Button
                            onClick={onClose}
                            disabled={busy}
                            color="inherit"
                        >
                            {t('actions.cancel')}
                        </Button>
                        <Button
                            onClick={onConfirm}
                            disabled={busy}
                            variant="contained"
                            color="error"
                        >
                            {busy
                                ? t('media.deleteMedia.deleting')
                                : t('actions.delete')}
                        </Button>
                    </Stack>
                </Stack>
            </ModalCard>
        </Modal>
    );
};

export default DeleteMediaModal;
