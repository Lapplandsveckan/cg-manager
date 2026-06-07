import { TextField, Typography } from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'next-i18next';
import { RundownEditorActionBar } from '../../lib';
import type { Rundown } from '../../hooks/useRundowns';

interface RenameRundownModalProps {
    rundown: Rundown;
    onUpdate: (rundown: Rundown) => void;
    onCancel: () => void;
}

export const RenameRundownModal: React.FC<RenameRundownModalProps> = ({
    rundown,
    onUpdate,
    onCancel,
}) => {
    const { t } = useTranslation('common');
    const [name, setName] = useState(rundown.name);
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
            />
        </>
    );
};
