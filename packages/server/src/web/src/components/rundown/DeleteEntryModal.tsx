import React from 'react';
import { Button, Card, Modal, Stack, Typography } from '@mui/material';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { useTranslation } from 'next-i18next/pages';
import { type RundownEntry } from '../../lib/query/rundownEntries';

interface DeleteEntryModalProps {
    entry: RundownEntry | null;
    onCancel: () => void;
    onConfirm: (entry: RundownEntry) => void;
}

export const DeleteEntryModal: React.FC<DeleteEntryModalProps> = ({
    entry,
    onCancel,
    onConfirm,
}) => {
    const { t } = useTranslation('common');

    return (
        <Modal open={entry !== null} onClose={onCancel}>
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
                                sx={theme => ({
                                    color: theme.palette.error.light,
                                })}
                            />
                            <Typography variant="h3">
                                {t('rundown.deleteEntryDialog.title')}
                            </Typography>
                        </Stack>
                        <Typography
                            variant="body1"
                            sx={{ color: 'text.secondary' }}
                        >
                            {t('rundown.deleteEntryDialog.body', {
                                title: entry?.title ?? '',
                                type: entry?.type ?? '',
                            })}
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
                                onClick={() => entry && onConfirm(entry)}
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
