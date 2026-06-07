import { Button, Modal, Stack, TextField, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'next-i18next';
import ModalCard from './ModalCard';

interface RenameMediaModalProps {
    open: boolean;
    renameValue: string;
    busy: boolean;
    error: string | null;
    onClose: () => void;
    onRenameValueChange: (value: string) => void;
    onConfirm: () => void;
}

const RenameMediaModal: React.FC<RenameMediaModalProps> = ({
    open,
    renameValue,
    busy,
    error,
    onClose,
    onRenameValueChange,
    onConfirm,
}) => {
    const { t } = useTranslation('common');

    return (
        <Modal open={open} onClose={() => !busy && onClose()}>
            <ModalCard>
                <Stack spacing={2}>
                    <Typography variant="h3">
                        {t('media.renameMedia.title')}
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{ color: 'text.secondary' }}
                    >
                        {t('media.renameMedia.body')}
                    </Typography>
                    <TextField
                        label={t('media.renameMedia.nameLabel')}
                        value={renameValue}
                        onChange={e => onRenameValueChange(e.target.value)}
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
                                ? t('media.renameMedia.renaming')
                                : t('actions.rename')}
                        </Button>
                    </Stack>
                </Stack>
            </ModalCard>
        </Modal>
    );
};

export default RenameMediaModal;
