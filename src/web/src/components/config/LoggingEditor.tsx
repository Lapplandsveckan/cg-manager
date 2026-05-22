import React from 'react';
import {Card, Divider, MenuItem, Stack, TextField, Typography} from '@mui/material';
import {CasparConfig} from '../../lib/api/caspar';

type LogLevel = NonNullable<CasparConfig['logLevel']>;

const LEVELS: { value: LogLevel; label: string; hint: string }[] = [
    { value: 'trace',   label: 'Trace',   hint: 'Everything, including AMCP traffic' },
    { value: 'debug',   label: 'Debug',   hint: 'Verbose diagnostic output' },
    { value: 'info',    label: 'Info',    hint: 'Default — high-level events' },
    { value: 'warning', label: 'Warning', hint: 'Unexpected but recoverable conditions' },
    { value: 'error',   label: 'Error',   hint: 'Failed operations only' },
    { value: 'fatal',   label: 'Fatal',   hint: 'Crashes only' },
];

interface LoggingEditorProps {
    logLevel: CasparConfig['logLevel'];
    onChange: (logLevel: LogLevel) => void;
}

export const LoggingEditor: React.FC<LoggingEditorProps> = ({logLevel, onChange}) => {
    const current: LogLevel = logLevel ?? 'trace';
    const hint = LEVELS.find(l => l.value === current)?.hint ?? '';

    return (
        <Card sx={{p: 3}}>
            <Stack spacing={2}>
                <Typography variant="h3">Logging</Typography>
                <Divider />
                <TextField
                    select
                    label="Log level"
                    size="small"
                    value={current}
                    onChange={(e) => onChange(e.target.value as LogLevel)}
                    helperText={hint}
                    sx={{maxWidth: 320}}
                >
                    {LEVELS.map(({value, label}) => (
                        <MenuItem key={value} value={value}>{label}</MenuItem>
                    ))}
                </TextField>
            </Stack>
        </Card>
    );
};
