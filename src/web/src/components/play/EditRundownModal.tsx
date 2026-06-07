import { Button, Modal, Stack, TextField, Typography } from '@mui/material';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import React, { useState } from 'react';
import { useTranslation } from 'next-i18next';
import { RundownEditorActionBar } from '../../lib';
import type { Rundown } from '../../hooks/useRundowns';

interface EditRundownModalProps {
    rundown: Rundown;
    onUpdate: (rundown: Rundown) => void;
    onDelete: () => void;
    onCancel: () => void;
}

export const EditRundownModal: React.FC<EditRundownModalProps> = ({
    rundown,
    onUpdate,
    onDelete,
    onCancel,
}) => {
    const { t } = useTranslation('common');
    const [name, setName] = useState(rundown.name);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const canSave = name.trim().length > 0 && name.trim() !== rundown.name;

    return (
        <>
            <Typography variant="h3">{t('playPage.renameRundown')}</Typography>
            <TextField
                label={t('playPage.nameLabel')}
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
                onKeyDown={e => {
                    if (e.key === 'Enter' && canSave)
                        onUpdate({ ...rundown, name: name.trim() });
                }}
            />

            <RundownEditorActionBar
                onCancel={onCancel}
                onSave={() =>
                    canSave && onUpdate({ ...rundown, name: name.trim() })
                }
                onDelete={() => setConfirmingDelete(true)}
            />

            <Modal
                open={confirmingDelete}
                onClose={() => setConfirmingDelete(false)}
            >
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
                    <Stack
                        padding={3}
                        spacing={2}
                        direction="column"
                        sx={theme => ({
                            bgcolor: theme.palette.surface.raised,
                            border: `1px solid ${theme.palette.divider}`,
                            borderRadius: 1.5,
                            width: 460,
                        })}
                    >
                        <Stack direction="row" alignItems="center" gap={1.5}>
                            <WarningAmberRoundedIcon
                                sx={{ color: '#e88c8c' }}
                            />
                            <Typography variant="h3">
                                {t('playPage.deleteDialog.titleAlt')}
                            </Typography>
                        </Stack>
                        <Typography
                            variant="body2"
                            sx={{ color: 'text.secondary' }}
                        >
                            <strong style={{ color: 'inherit' }}>
                                {rundown.name}
                            </strong>{' '}
                            {t('playPage.deleteDialog.bodyAfterName')}
                        </Typography>
                        <Stack
                            direction="row"
                            justifyContent="flex-end"
                            gap={1}
                        >
                            <Button
                                color="inherit"
                                onClick={() => setConfirmingDelete(false)}
                            >
                                {t('actions.cancel')}
                            </Button>
                            <Button
                                variant="contained"
                                color="error"
                                onClick={() => {
                                    setConfirmingDelete(false);
                                    onDelete();
                                }}
                            >
                                {t('actions.delete')}
                            </Button>
                        </Stack>
                    </Stack>
                </Stack>
            </Modal>
        </>
    );
};
