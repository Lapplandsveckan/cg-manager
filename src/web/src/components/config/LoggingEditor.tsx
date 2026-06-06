import React from 'react';
import {Card, Divider, MenuItem, Stack, TextField, Typography} from '@mui/material';
import {useTranslation} from 'next-i18next';
import {type CasparConfig} from '../../lib/api/caspar';

type LogLevel = NonNullable<CasparConfig['logLevel']>;

const LEVELS: LogLevel[] = ['trace', 'debug', 'info', 'warning', 'error', 'fatal'];

interface LoggingEditorProps {
    logLevel: CasparConfig['logLevel'];
    onChange: (logLevel: LogLevel) => void;
}

export const LoggingEditor: React.FC<LoggingEditorProps> = ({logLevel, onChange}) => {
    const {t} = useTranslation('common');
    const current: LogLevel = logLevel ?? 'trace';
    const hint = t(`config.logging.hints.${current}`, {defaultValue: ''});

    return (
        <Card sx={{p: 3}}>
            <Stack spacing={2}>
                <Typography variant="h3">{t('config.logging.title')}</Typography>
                <Divider />
                <TextField
                    select
                    label={t('config.logging.logLevel')}
                    size="small"
                    value={current}
                    onChange={(e) => onChange(e.target.value as LogLevel)}
                    helperText={hint}
                    sx={{maxWidth: 320}}
                >
                    {LEVELS.map((value) => (
                        <MenuItem key={value} value={value}>
                            {t(`config.logging.levels.${value}`)}
                        </MenuItem>
                    ))}
                </TextField>
            </Stack>
        </Card>
    );
};
