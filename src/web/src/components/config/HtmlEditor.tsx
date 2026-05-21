import React from 'react';
import {Card, Divider, FormControlLabel, Stack, Switch, TextField, Typography} from '@mui/material';
import {CasparConfig} from '../../lib/api/caspar';

interface HtmlEditorProps {
    html: CasparConfig['html'];
    onChange: (html: CasparConfig['html']) => void;
}

export const HtmlEditor: React.FC<HtmlEditorProps> = ({html, onChange}) => {
    const value = html ?? {};
    return (
        <Card sx={{p: 3}}>
            <Stack spacing={2}>
                <Typography variant="h3">HTML</Typography>
                <Divider />
                <TextField
                    label="Remote debugging port"
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
                    helperText="Default 9222 when blank"
                    sx={{maxWidth: 320}}
                />
                <FormControlLabel
                    control={
                        <Switch
                            checked={Boolean(value.enableGpu)}
                            onChange={(e) => onChange({...value, enableGpu: e.target.checked})}
                        />
                    }
                    label="Enable GPU"
                />
            </Stack>
        </Card>
    );
};
