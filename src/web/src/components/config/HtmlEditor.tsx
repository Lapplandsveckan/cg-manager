import React from 'react';
import {Card, Divider, FormControlLabel, Stack, Switch, TextField, Typography} from '@mui/material';
import {useTranslation} from 'next-i18next';
import {type CasparConfig} from '../../lib/api/caspar';

interface HtmlEditorProps {
    html: CasparConfig['html'];
    onChange: (html: CasparConfig['html']) => void;
}

export const HtmlEditor: React.FC<HtmlEditorProps> = ({html, onChange}) => {
    const {t} = useTranslation('common');
    const value = html ?? {};
    return (
        <Card sx={{p: 3}}>
            <Stack spacing={2}>
                <Typography variant="h3">{t('config.html.title')}</Typography>
                <Divider />
                <TextField
                    label={t('config.html.remoteDebuggingPort')}
                    type="number"
                    size="small"
                    value={value.remoteDebuggingPort ?? ''}
                    onChange={(e) => {
                        const n = Number(e.target.value);
                        onChange({
                            ...value,
                            remoteDebuggingPort: Number.isFinite(n) && e.target.value !== '' ? n : undefined,
                        });
                    }}
                    helperText={t('config.html.remoteDebuggingPortHelp')}
                    sx={{maxWidth: 320}}
                />
                <FormControlLabel
                    control={
                        <Switch
                            checked={Boolean(value.enableGpu)}
                            onChange={(e) => onChange({...value, enableGpu: e.target.checked})}
                        />
                    }
                    label={t('config.html.enableGpu')}
                />
            </Stack>
        </Card>
    );
};
