import React, { useState } from 'react';
import { useTranslation } from 'next-i18next';
import { IconButton, Stack, Tooltip, Typography } from '@mui/material';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { SlotErrorBoundary } from '../SlotErrorBoundary';
import { ModalShell } from './ModalShell';
import { RenameRundownModal } from './RenameRundownModal';

interface RundownTitleEditorProps {
    name: string;
    rundownId: string;
    onRename: (name: string) => void;
}

export const RundownTitleEditor: React.FC<RundownTitleEditorProps> = ({
    name,
    rundownId,
    onRename,
}) => {
    const { t } = useTranslation('common');
    const [open, setOpen] = useState(false);

    return (
        <SlotErrorBoundary label="rundown-title">
            <Stack direction="row" alignItems="center" gap={0.5}>
                <Typography
                    variant="h2"
                    sx={{
                        fontSize: '1.75rem',
                        lineHeight: 1.2,
                        wordBreak: 'break-word',
                        color: name ? 'text.primary' : 'text.disabled',
                    }}
                >
                    {name || t('playPage.detail.untitled')}
                </Typography>
                <Tooltip title={t('playPage.renameRundown')}>
                    <IconButton
                        size="small"
                        onClick={() => setOpen(true)}
                        sx={{ color: 'text.secondary' }}
                    >
                        <EditRoundedIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Stack>

            <ModalShell open={open} onClose={() => setOpen(false)}>
                {open && (
                    <RenameRundownModal
                        rundown={{ id: rundownId, name, items: [] }}
                        onUpdate={entry => {
                            onRename(entry.name);
                            setOpen(false);
                        }}
                        onCancel={() => setOpen(false)}
                    />
                )}
            </ModalShell>
        </SlotErrorBoundary>
    );
};
