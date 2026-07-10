import { Button, Modal, Stack, Typography } from '@mui/material';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import React from 'react';
import { useTranslation } from 'next-i18next';
import { type MediaDoc } from '../../lib/api/caspar';
import ModalCard from './ModalCard';

interface DeleteMediaModalProps {
    open: boolean;
    deleting: MediaDoc | null;
    /** When set (non-empty), the modal renders a bulk-delete confirmation
     *  instead of the single-item one — including for a single item, so
     *  the count-aware copy still shows the file's name. Takes priority
     *  over `deleting`. */
    items?: MediaDoc[];
    busy: boolean;
    error: string | null;
    onClose: () => void;
    onConfirm: () => void;
}

const DeleteMediaModal: React.FC<DeleteMediaModalProps> = ({
    open,
    deleting,
    items,
    busy,
    error,
    onClose,
    onConfirm,
}) => {
    const { t } = useTranslation('common');
    const isBulk = Boolean(items && items.length > 0);

    return (
        <Modal open={open} onClose={() => !busy && onClose()}>
            <ModalCard>
                <Stack spacing={2}>
                    <Stack direction="row" alignItems="center" gap={1.5}>
                        <WarningAmberRoundedIcon sx={{ color: '#e88c8c' }} />
                        <Typography variant="h3">
                            {isBulk
                                ? t('media.deleteMedia.bulkTitle', {
                                      count: items?.length,
                                  })
                                : t('media.deleteMedia.title')}
                        </Typography>
                    </Stack>
                    {isBulk ? (
                        <Stack spacing={1}>
                            <Typography
                                variant="body2"
                                sx={{
                                    color: 'text.secondary',
                                    maxHeight: 140,
                                    overflowY: 'auto',
                                    wordBreak: 'break-all',
                                }}
                            >
                                {items?.map(doc => doc.id).join(', ')}
                            </Typography>
                            <Typography
                                variant="body1"
                                sx={{ color: 'text.secondary' }}
                            >
                                {t('media.deleteMedia.bulkBody')}
                            </Typography>
                        </Stack>
                    ) : (
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
                                ? isBulk
                                    ? t('media.deleteMedia.bulkDeleting', {
                                          count: items?.length,
                                      })
                                    : t('media.deleteMedia.deleting')
                                : t('actions.delete')}
                        </Button>
                    </Stack>
                </Stack>
            </ModalCard>
        </Modal>
    );
};

export default DeleteMediaModal;
