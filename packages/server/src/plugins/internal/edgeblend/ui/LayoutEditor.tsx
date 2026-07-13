import React from 'react';
import {
    Box,
    Button,
    Chip,
    FormControl,
    FormHelperText,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Switch,
    TextField,
    Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

export interface StoredLayout {
    id: string;
    name: string;
    enabled: boolean;
    canvasSize: [number, number];
    projectorSize: [number, number];
    size: [number, number];
    inputChannel: number;
    outputChannels: number[];
}

export interface LayoutForm {
    name: string;
    canvasW: number;
    canvasH: number;
    projectorW: number;
    projectorH: number;
    cols: number;
    rows: number;
    inputChannel: number;
    outputChannels: number[];
}

export const DEFAULT_FORM: LayoutForm = {
    name: '',
    canvasW: 3840,
    canvasH: 2160,
    projectorW: 1920,
    projectorH: 1080,
    cols: 2,
    rows: 1,
    inputChannel: 1,
    outputChannels: [2, 3],
};

export const toForm = (l: StoredLayout): LayoutForm => ({
    name: l.name,
    canvasW: l.canvasSize[0],
    canvasH: l.canvasSize[1],
    projectorW: l.projectorSize[0],
    projectorH: l.projectorSize[1],
    cols: l.size[0],
    rows: l.size[1],
    inputChannel: l.inputChannel,
    outputChannels: l.outputChannels,
});

export const fromForm = (f: LayoutForm, enabled: boolean) => ({
    name: f.name.trim(),
    enabled,
    canvasSize: [f.canvasW, f.canvasH] as [number, number],
    projectorSize: [f.projectorW, f.projectorH] as [number, number],
    size: [f.cols, f.rows] as [number, number],
    inputChannel: f.inputChannel,
    outputChannels: f.outputChannels,
});

interface Props {
    selected: string | 'new';
    form: LayoutForm;
    setForm: React.Dispatch<React.SetStateAction<LayoutForm>>;
    editEnabled: boolean;
    setEditEnabled: (v: boolean) => void;
    channels: number[];
    gridCount: number;
    isValid: boolean;
    saving: boolean;
    setGrid: (cols: number, rows: number) => void;
    setOutput: (idx: number, ch: number) => void;
    onSave: () => void;
    onClose: () => void;
    onDelete: () => void;
    /** Index of the projector currently focused in the diagram. */
    focusedOutput?: number | null;
}

const LayoutEditor: React.FC<Props> = ({
    selected,
    form,
    setForm,
    editEnabled,
    setEditEnabled,
    channels,
    gridCount,
    isValid,
    saving,
    setGrid,
    setOutput,
    onSave,
    onClose,
    onDelete,
    focusedOutput,
}) => {
    const { t } = useTranslation();

    return (
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
            <Typography variant="h3" mb={2}>
                {selected === 'new'
                    ? t('plugins.edgeblend.newLayout')
                    : t('plugins.edgeblend.editLayout')}
            </Typography>

            <Stack spacing={2} maxWidth={480}>
                <TextField
                    label={t('plugins.edgeblend.name')}
                    value={form.name}
                    onChange={e =>
                        setForm(p => ({ ...p, name: e.target.value }))
                    }
                    size="small"
                    fullWidth
                    required
                />

                <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" sx={{ width: 120 }}>
                        {t('plugins.edgeblend.canvasSize')}
                    </Typography>
                    <TextField
                        label={t('plugins.edgeblend.width')}
                        type="number"
                        value={form.canvasW}
                        onChange={e =>
                            setForm(p => ({
                                ...p,
                                canvasW: Number(e.target.value),
                            }))
                        }
                        size="small"
                        sx={{ width: 110 }}
                    />
                    <Typography>×</Typography>
                    <TextField
                        label={t('plugins.edgeblend.height')}
                        type="number"
                        value={form.canvasH}
                        onChange={e =>
                            setForm(p => ({
                                ...p,
                                canvasH: Number(e.target.value),
                            }))
                        }
                        size="small"
                        sx={{ width: 110 }}
                    />
                </Stack>

                <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" sx={{ width: 120 }}>
                        {t('plugins.edgeblend.projectorSize')}
                    </Typography>
                    <TextField
                        label={t('plugins.edgeblend.width')}
                        type="number"
                        value={form.projectorW}
                        onChange={e =>
                            setForm(p => ({
                                ...p,
                                projectorW: Number(e.target.value),
                            }))
                        }
                        size="small"
                        sx={{ width: 110 }}
                    />
                    <Typography>×</Typography>
                    <TextField
                        label={t('plugins.edgeblend.height')}
                        type="number"
                        value={form.projectorH}
                        onChange={e =>
                            setForm(p => ({
                                ...p,
                                projectorH: Number(e.target.value),
                            }))
                        }
                        size="small"
                        sx={{ width: 110 }}
                    />
                </Stack>

                <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" sx={{ width: 120 }}>
                        {t('plugins.edgeblend.grid')}
                    </Typography>
                    <TextField
                        label={t('plugins.edgeblend.cols')}
                        type="number"
                        value={form.cols}
                        onChange={e =>
                            setGrid(
                                Math.max(1, Number(e.target.value)),
                                form.rows,
                            )
                        }
                        inputProps={{ min: 1 }}
                        size="small"
                        sx={{ width: 80 }}
                    />
                    <Typography>×</Typography>
                    <TextField
                        label={t('plugins.edgeblend.rows')}
                        type="number"
                        value={form.rows}
                        onChange={e =>
                            setGrid(
                                form.cols,
                                Math.max(1, Number(e.target.value)),
                            )
                        }
                        inputProps={{ min: 1 }}
                        size="small"
                        sx={{ width: 80 }}
                    />
                    <Chip
                        size="small"
                        label={`${gridCount} ${t('plugins.edgeblend.projectors')}`}
                    />
                </Stack>

                <FormControl size="small" fullWidth>
                    <InputLabel>
                        {t('plugins.edgeblend.inputChannel')}
                    </InputLabel>
                    <Select
                        label={t('plugins.edgeblend.inputChannel')}
                        value={form.inputChannel}
                        onChange={e =>
                            setForm(p => ({
                                ...p,
                                inputChannel: Number(e.target.value),
                            }))
                        }
                    >
                        {channels.map(ch => (
                            <MenuItem key={ch} value={ch}>
                                {t('plugins.edgeblend.channelN', { n: ch })}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <Box>
                    <Typography variant="body2" gutterBottom>
                        {t('plugins.edgeblend.outputChannels')}
                    </Typography>
                    <Stack spacing={1}>
                        {Array.from({ length: gridCount }, (_, i) => {
                            const col = i % form.cols;
                            const row = Math.floor(i / form.cols);
                            const highlighted = focusedOutput === i;
                            return (
                                <Stack
                                    key={i}
                                    direction="row"
                                    spacing={1}
                                    alignItems="center"
                                    sx={
                                        highlighted
                                            ? {
                                                  borderLeft:
                                                      '3px solid #c98049',
                                                  pl: 0.75,
                                              }
                                            : {
                                                  borderLeft:
                                                      '3px solid transparent',
                                                  pl: 0.75,
                                              }
                                    }
                                >
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            width: 80,
                                            color: 'text.secondary',
                                        }}
                                    >
                                        {t('plugins.edgeblend.projectorPos', {
                                            col: col + 1,
                                            row: row + 1,
                                        })}
                                    </Typography>
                                    <FormControl
                                        size="small"
                                        sx={{ width: 160 }}
                                    >
                                        <InputLabel>
                                            {t('plugins.edgeblend.channel')}
                                        </InputLabel>
                                        <Select
                                            label={t(
                                                'plugins.edgeblend.channel',
                                            )}
                                            value={form.outputChannels[i] ?? ''}
                                            onChange={e =>
                                                setOutput(
                                                    i,
                                                    Number(e.target.value),
                                                )
                                            }
                                        >
                                            {channels.map(ch => (
                                                <MenuItem key={ch} value={ch}>
                                                    {t(
                                                        'plugins.edgeblend.channelN',
                                                        {
                                                            n: ch,
                                                        },
                                                    )}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Stack>
                            );
                        })}
                    </Stack>
                    {form.outputChannels.length !== gridCount && (
                        <FormHelperText error>
                            {t('plugins.edgeblend.outputCountError', {
                                count: gridCount,
                            })}
                        </FormHelperText>
                    )}
                </Box>

                {selected !== 'new' && (
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2">
                            {t('plugins.edgeblend.enabledInEdit')}
                        </Typography>
                        <Switch
                            checked={editEnabled}
                            onChange={e => setEditEnabled(e.target.checked)}
                            size="small"
                        />
                    </Stack>
                )}

                <Stack direction="row" spacing={1} pt={1}>
                    <Button
                        variant="contained"
                        onClick={onSave}
                        disabled={!isValid || saving}
                    >
                        {saving
                            ? t('plugins.edgeblend.saving')
                            : t('actions.save')}
                    </Button>
                    <Button variant="outlined" onClick={onClose}>
                        {t('actions.cancel')}
                    </Button>
                    {selected !== 'new' && (
                        <Button
                            variant="outlined"
                            color="error"
                            onClick={onDelete}
                            sx={{ ml: 'auto' }}
                        >
                            {t('actions.delete')}
                        </Button>
                    )}
                </Stack>
            </Stack>
        </Box>
    );
};

export default LayoutEditor;
