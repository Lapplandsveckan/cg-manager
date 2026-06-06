import React from 'react';
import {Button, Card, Divider, IconButton, Stack, TextField, Tooltip, Typography} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import {useTranslation} from 'next-i18next';
import {type CasparConfig} from '../../lib/api/caspar';

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
    const {t} = useTranslation('common');
    const update = (i: number, patch: Partial<VideoMode>) =>
        onChange(modes.map((m, idx) => (idx === i ? {...m, ...patch} : m)));
    const remove = (i: number) => onChange(modes.filter((_, idx) => idx !== i));
    const add = () => onChange([...modes, blankVideoMode()]);

    return (
        <Card sx={{p: 3}}>
            <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="h3">{t('config.videoModes.title')}</Typography>
                    <Button startIcon={<AddRoundedIcon />} size="small" onClick={add}>
                        {t('config.videoModes.add')}
                    </Button>
                </Stack>
                <Divider />
                {modes.length === 0 && (
                    <Typography variant="body2" sx={{color: 'text.secondary'}}>
                        {t('config.videoModes.empty')}
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
                            label={t('config.videoModes.id')}
                            size="small"
                            value={mode.id}
                            onChange={(e) => update(i, {id: e.target.value})}
                            sx={{minWidth: 180, flex: 2}}
                        />
                        <TextField
                            label={t('config.fields.width')}
                            size="small"
                            type="number"
                            value={mode.width}
                            onChange={(e) => update(i, {width: Number(e.target.value) || 0})}
                            sx={{flex: 1}}
                        />
                        <TextField
                            label={t('config.fields.height')}
                            size="small"
                            type="number"
                            value={mode.height}
                            onChange={(e) => update(i, {height: Number(e.target.value) || 0})}
                            sx={{flex: 1}}
                        />
                        <TextField
                            label={t('config.videoModes.timeScale')}
                            size="small"
                            type="number"
                            value={mode.timeScale}
                            onChange={(e) => update(i, {timeScale: Number(e.target.value) || 0})}
                            sx={{flex: 1}}
                        />
                        <TextField
                            label={t('config.videoModes.duration')}
                            size="small"
                            type="number"
                            value={mode.duration}
                            onChange={(e) => update(i, {duration: Number(e.target.value) || 0})}
                            sx={{flex: 1}}
                        />
                        <TextField
                            label={t('config.videoModes.cadence')}
                            size="small"
                            type="number"
                            value={mode.cadence}
                            onChange={(e) => update(i, {cadence: Number(e.target.value) || 0})}
                            sx={{flex: 1}}
                        />
                        <Tooltip title={t('actions.delete')}>
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
