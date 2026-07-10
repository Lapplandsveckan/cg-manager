import { Stack, TextField, Typography } from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'next-i18next';
import { noTry } from 'no-try';
import { RundownEditorActionBar } from './RundownEditor';
import { type RundownEntry } from './Rundowns';

interface EditorProps {
    entry: RundownEntry;
    creating: boolean;
    updateEntry: (entry: RundownEntry) => void;
    deleteEntry: (entry: RundownEntry) => void;
    onCancel?: () => void;
}

// Generic fallback editor used when a registered rundown action has no
// `rundown-editor.<type>` UI injection of its own.
export const DefaultRundownItemEditor: React.FC<EditorProps> = ({
    entry,
    creating,
    updateEntry,
    deleteEntry,
    onCancel,
}) => {
    const { t } = useTranslation('common');
    const [title, setTitle] = useState(entry.title ?? '');
    const [dataText, setDataText] = useState(
        JSON.stringify(entry.data ?? {}, null, 2),
    );
    const [error, setError] = useState<string | null>(null);

    const validate = () => {
        const [err, parsed] = noTry(() => JSON.parse(dataText));
        setError(err ? t('rundown.defaultEditor.invalidData') : null);
        return [err, parsed] as const;
    };

    const onSave = () => {
        const [err, parsed] = validate();
        if (err) return;

        updateEntry({
            ...entry,
            title: title.trim() || entry.title,
            data: parsed,
        });
    };

    return (
        <Stack spacing={2.5}>
            <Stack spacing={0.5}>
                <Typography variant="h3">
                    {t('rundown.defaultEditor.title')}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {t('rundown.defaultEditor.description')}
                </Typography>
            </Stack>

            <TextField
                label={t('rundown.defaultEditor.titleLabel')}
                value={title}
                onChange={e => setTitle(e.target.value)}
                size="small"
                fullWidth
            />

            <TextField
                label={t('rundown.defaultEditor.dataLabel')}
                value={dataText}
                onChange={e => setDataText(e.target.value)}
                size="small"
                fullWidth
                multiline
                minRows={4}
                maxRows={12}
                error={Boolean(error)}
                helperText={error ?? undefined}
                sx={{
                    '& textarea': {
                        fontFamily: '"SF Mono", "Menlo", "Consolas", monospace',
                    },
                }}
            />

            <RundownEditorActionBar
                onSave={onSave}
                onCancel={onCancel}
                onDelete={creating ? undefined : () => deleteEntry(entry)}
            />
        </Stack>
    );
};

interface ViewProps {
    entry: RundownEntry;
}

// Generic fallback body content used when a registered rundown action has no
// `rundown-item.<type>` UI injection of its own.
export const DefaultRundownItemView: React.FC<ViewProps> = ({ entry }) => {
    if (!entry.data || Object.keys(entry.data).length === 0) return null;

    return (
        <Typography
            variant="caption"
            sx={theme => ({
                color: theme.palette.text.disabled,
                fontFamily: '"SF Mono", "Menlo", "Consolas", monospace',
                wordBreak: 'break-all',
            })}
        >
            {JSON.stringify(entry.data)}
        </Typography>
    );
};
