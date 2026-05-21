import React from 'react';
import {Button, Card, Divider, IconButton, Stack, TextField, Tooltip, Typography} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import {CasparConfig} from '../../lib/api/caspar';

type VideoMode = CasparConfig['videoModes'][number];

interface VideoModesEditorProps {
    modes: VideoMode[];
    onChange: (modes: VideoMode[]) => void;
}

const blankVideoMode = (): VideoMode => ({
    id: 'custom',
    width: 1920,
    height: 1080,
    timeScale: 5000,
    duration: 1000,
    cadence: 800,
});

export const VideoModesEditor: React.FC<VideoModesEditorProps> = ({modes, onChange}) => {
    const update = (i: number, patch: Partial<VideoMode>) =>
        onChange(modes.map((m, idx) => (idx === i ? {...m, ...patch} : m)));
    const remove = (i: number) => onChange(modes.filter((_, idx) => idx !== i));
    const add = () => onChange([...modes, blankVideoMode()]);

    return (
        <Card sx={{p: 3}}>
            <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="h3">Video modes</Typography>
                    <Button startIcon={<AddRoundedIcon />} size="small" onClick={add}>
                        Add mode
                    </Button>
                </Stack>
                <Divider />
                {modes.length === 0 && (
                    <Typography variant="body2" sx={{color: 'text.secondary'}}>
                        No custom video modes (CasparCG built-ins still apply).
                    </Typography>
                )}
                {modes.map((mode, i) => (
                    <Stack
                        key={i}
                        direction={{xs: 'column', md: 'row'}}
                        gap={1.5}
                        alignItems={{xs: 'stretch', md: 'flex-start'}}
                    >
                        <TextField
                            label="ID"
                            size="small"
                            value={mode.id}
                            onChange={(e) => update(i, {id: e.target.value})}
                            sx={{minWidth: 180, flex: 2}}
                        />
                        <TextField
                            label="Width"
                            size="small"
                            type="number"
                            value={mode.width}
                            onChange={(e) => update(i, {width: Number(e.target.value) || 0})}
                            sx={{flex: 1}}
                        />
                        <TextField
                            label="Height"
                            size="small"
                            type="number"
                            value={mode.height}
                            onChange={(e) => update(i, {height: Number(e.target.value) || 0})}
                            sx={{flex: 1}}
                        />
                        <TextField
                            label="Time scale"
                            size="small"
                            type="number"
                            value={mode.timeScale}
                            onChange={(e) => update(i, {timeScale: Number(e.target.value) || 0})}
                            sx={{flex: 1}}
                        />
                        <TextField
                            label="Duration"
                            size="small"
                            type="number"
                            value={mode.duration}
                            onChange={(e) => update(i, {duration: Number(e.target.value) || 0})}
                            sx={{flex: 1}}
                        />
                        <TextField
                            label="Cadence"
                            size="small"
                            type="number"
                            value={mode.cadence}
                            onChange={(e) => update(i, {cadence: Number(e.target.value) || 0})}
                            sx={{flex: 1}}
                        />
                        <Tooltip title="Delete">
                            <IconButton onClick={() => remove(i)} sx={{alignSelf: 'center'}}>
                                <DeleteOutlineRoundedIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                ))}
            </Stack>
        </Card>
    );
};
