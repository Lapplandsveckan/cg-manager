import { Button, Modal, Stack, TextField, Typography } from '@mui/material';
import CreateNewFolderRoundedIcon from '@mui/icons-material/CreateNewFolderRounded';
import React from 'react';
import { useTranslation } from 'next-i18next';
import ModalCard from './ModalCard';

interface CreateFolderModalProps {
    open: boolean;
    folderName: string;
    currentPath: string;
    busy: boolean;
    error: string | null;
    onClose: () => void;
    onFolderNameChange: (name: string) => void;
    onConfirm: () => void;
}

const CreateFolderModal: React.FC<CreateFolderModalProps> = ({
    open,
    folderName,
    currentPath,
    busy,
    error,
    onClose,
    onFolderNameChange,
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
                        <CreateNewFolderRoundedIcon
                            sx={{ color: 'primary.main' }}
                        />
                        <Typography variant="h3">
                            {t('media.createFolder.title')}
                        </Typography>
                    </Stack>
                    <Typography
                        variant="body2"
                        sx={{ color: 'text.secondary' }}
                    >
                        {t('media.createFolder.bodyBefore')}{' '}
                        <strong>{currentPath || '/'}</strong>
                        {t('media.createFolder.bodyBetween')} <code>/</code>
                        {t('media.createFolder.bodyAfter')}
                    </Typography>
                    <TextField
                        label={t('media.createFolder.nameLabel')}
                        value={folderName}
                        onChange={e => onFolderNameChange(e.target.value)}
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
                            disabled={busy || !folderName.trim()}
                            variant="contained"
                        >
                            {busy
                                ? t('media.createFolder.creating')
                                : t('actions.create')}
                        </Button>
                    </Stack>
                </Stack>
            </ModalCard>
        </Modal>
    );
};

export default CreateFolderModal;
