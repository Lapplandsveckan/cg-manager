import React, { useEffect, useState } from 'react';
import { MenuItem, Stack, TextField } from '@mui/material';
import { useSocket } from '@web-lib';
import { useTranslation } from 'react-i18next';
import { noTryAsync } from 'no-try';
import { type IngestSession } from '../../../../web/src/lib/api/ingest';
import { API_ROOT } from './api';

interface EditorProps {
    data: Record<string, unknown>;
    onChange: (data: Record<string, unknown>) => void;
}

const ScreenshareEditor: React.FC<EditorProps> = ({ data, onChange }) => {
    const conn = useSocket();
    const { t } = useTranslation('screenshare');
    const [sessions, setSessions] = useState<IngestSession[]>([]);

    useEffect(() => {
        (async () => {
            const [, list] = await noTryAsync(() =>
                conn.rawRequest(`${API_ROOT}/sessions`, 'GET', null),
            );
            if (Array.isArray(list)) setSessions(list as IngestSession[]);
        })();
    }, [conn]);

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
                value={sessionId}
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
