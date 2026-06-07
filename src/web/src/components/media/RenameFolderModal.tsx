import { Button, Modal, Stack, TextField, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'next-i18next';
import ModalCard from './ModalCard';

interface RenameFolderModalProps {
    open: boolean;
    folderRenameValue: string;
    busy: boolean;
    error: string | null;
    onClose: () => void;
    onFolderRenameValueChange: (value: string) => void;
    onConfirm: () => void;
}

const RenameFolderModal: React.FC<RenameFolderModalProps> = ({
    open,
    folderRenameValue,
    busy,
    error,
    onClose,
    onFolderRenameValueChange,
    onConfirm,
}) => {
    const { t } = useTranslation('common');

    return (
        <Modal open={open} onClose={() => !busy && onClose()}>
            <ModalCard>
                <Stack spacing={2}>
                    <Typography variant="h3">
                        {t('media.renameFolder.title')}
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{ color: 'text.secondary' }}
                    >
                        {t('media.renameFolder.body')}
                    </Typography>
                    <TextField
                        label={t('media.renameFolder.nameLabel')}
                        value={folderRenameValue}
                        onChange={e =>
                            onFolderRenameValueChange(e.target.value)
                        }
                        autoFocus
                        disabled={busy}
                        onKeyDown={e => {
                            if (e.key === 'Enter') onConfirm();
                        }}
                    />
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
                        >
                            {busy
                                ? t('media.renameFolder.renaming')
                                : t('actions.rename')}
                        </Button>
                    </Stack>
                </Stack>
            </ModalCard>
        </Modal>
    );
};

export default RenameFolderModal;
