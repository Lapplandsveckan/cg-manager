import { Button, Modal, Stack, Typography } from '@mui/material';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import React from 'react';
import { useTranslation } from 'next-i18next';
import ModalCard from './ModalCard';

interface DeleteFolderModalProps {
    open: boolean;
    folderPath: string;
    folderName: string | null;
    /** True once the server has rejected a plain delete because the folder
     *  isn't empty — switches the modal to the recursive-delete warning. */
    notEmpty?: boolean;
    busy: boolean;
    error: string | null;
    onClose: () => void;
    onConfirm: () => void;
}

const DeleteFolderModal: React.FC<DeleteFolderModalProps> = ({
    open,
    folderPath,
    folderName,
    notEmpty,
    busy,
    error,
    onClose,
    onConfirm,
}) => {
    const { t } = useTranslation('common');

    return (
        <Modal
            open={open}
            onClose={() => {
                if (!busy) onClose();
            }}
        >
            <ModalCard>
                <Stack spacing={2}>
                    <Stack direction="row" alignItems="center" gap={1.5}>
                        <WarningAmberRoundedIcon sx={{ color: '#e88c8c' }} />
                        <Typography variant="h3">
                            {t('media.deleteFolder.title')}
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
                            {folderPath}
                            {folderName}
                        </strong>{' '}
                        {t('media.deleteFolder.body')}
                    </Typography>
                    {notEmpty && (
                        <Typography variant="body2" color="error">
                            {t('media.deleteFolder.notEmptyWarning')}
                        </Typography>
                    )}
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
                                : notEmpty
                                  ? t('media.deleteFolder.deleteAll')
                                  : t('actions.delete')}
                        </Button>
                    </Stack>
                </Stack>
            </ModalCard>
        </Modal>
    );
};

export default DeleteFolderModal;
