import React from 'react';
import { MenuItem, Stack, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useIngestSessions } from './data';

interface EditorProps {
    data: Record<string, unknown>;
    onChange: (data: Record<string, unknown>) => void;
}

const ScreenshareEditor: React.FC<EditorProps> = ({ data, onChange }) => {
    const { t } = useTranslation('screenshare');
    const { sessions } = useIngestSessions();

    const sessionId = typeof data.sessionId === 'string' ? data.sessionId : '';
    const effectLayer =
        typeof data.effectLayer === 'string' ? data.effectLayer : '';

    return (
        <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
                select
                fullWidth
                label={t('editor.session')}
                helperText={t('editor.sessionHint')}
                value={sessions.some(s => s.id === sessionId) ? sessionId : ''}
                onChange={e => onChange({ ...data, sessionId: e.target.value })}
            >
                {sessions.map(session => (
                    <MenuItem key={session.id} value={session.id}>
                        {session.label}
                    </MenuItem>
                ))}
            </TextField>

            <TextField
                fullWidth
                label={t('editor.destination')}
                helperText={t('editor.destinationHint')}
                value={effectLayer}
                onChange={e =>
                    onChange({ ...data, effectLayer: e.target.value })
                }
            />
        </Stack>
    );
};

export default ScreenshareEditor;
