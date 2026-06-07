import { TextField, Typography } from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'next-i18next';
import { RundownEditorActionBar } from '../../lib';

interface AddRundownModalProps {
    onCreate: (name: string) => void;
    onCancel: () => void;
}

export const AddRundownModal: React.FC<AddRundownModalProps> = ({
    onCreate,
    onCancel,
}) => {
    const { t } = useTranslation('common');
    const [name, setName] = useState('');
    const trimmed = name.trim();

    return (
        <>
            <Typography variant="h3">{t('playPage.newRundown')}</Typography>
            <TextField
                label={t('playPage.nameLabel')}
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
                onKeyDown={e => {
                    if (e.key === 'Enter' && trimmed) onCreate(trimmed);
                }}
            />

            <RundownEditorActionBar
                onCancel={onCancel}
                onSave={() => trimmed && onCreate(trimmed)}
            />
        </>
    );
};
