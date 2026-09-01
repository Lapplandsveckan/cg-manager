import React, { useState } from 'react';
import {
    FormControl,
    FormHelperText,
    InputLabel,
    ListSubheader,
    MenuItem,
    Select,
    Stack,
    Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { BUILTIN_VIDEO_MODES } from '../../../lib/videoModes';
import { RESOLUTION_PRESETS } from '../../../lib/config/simplePresets';

const OTHER = '__other__';

interface ResolutionPickerProps {
    value: string;
    customVideoModeIds: readonly string[];
    onChange: (mode: string) => void;
}

export const ResolutionPicker: React.FC<ResolutionPickerProps> = ({
    value,
    customVideoModeIds,
    onChange,
}) => {
    const { t } = useTranslation('common');
    const presetIds = RESOLUTION_PRESETS.map(p => p.id);
    const isPreset = presetIds.includes(value);
    const isBuiltin = (BUILTIN_VIDEO_MODES as readonly string[]).includes(
        value,
    );
    const isCustom = value !== '' && !isPreset && !isBuiltin;
    const offPreset = value !== '' && !isPreset;

    // "Other…" expands into the full built-in + custom list once picked, or
    // whenever the channel is already on a mode outside the curated presets
    // — never silently rewrites an id the operator didn't choose. Derived
    // from `value` on every render (not stored) so switching channels or a
    // remote config update never leaves it showing a stale expansion.
    const [otherPicked, setOtherPicked] = useState(false);
    const expanded = otherPicked || offPreset;

    const selectValue = expanded ? value : offPreset ? OTHER : value;

    return (
        <Stack spacing={0.5} sx={{ maxWidth: 360 }}>
            <FormControl size="small" fullWidth>
                <InputLabel>{t('config.simple.resolution.label')}</InputLabel>
                <Select
                    label={t('config.simple.resolution.label')}
                    value={selectValue}
                    onChange={e => {
                        const next = e.target.value as string;
                        if (next === OTHER) {
                            setOtherPicked(true);
                            return;
                        }
                        onChange(next);
                    }}
                >
                    {RESOLUTION_PRESETS.map(preset => (
                        <MenuItem key={preset.id} value={preset.id}>
                            {t(preset.labelKey)}
                        </MenuItem>
                    ))}

                    {!expanded && (
                        <MenuItem value={OTHER}>
                            {t('config.simple.resolution.other')}
                        </MenuItem>
                    )}

                    {expanded &&
                        customVideoModeIds.length > 0 && [
                            <ListSubheader key="__custom-header">
                                {t('config.videoModes.custom')}
                            </ListSubheader>,
                            ...customVideoModeIds.map(id => (
                                <MenuItem key={id} value={id}>
                                    {id}
                                </MenuItem>
                            )),
                        ]}

                    {expanded && [
                        <ListSubheader key="__builtin-header">
                            {t('config.videoModes.builtin')}
                        </ListSubheader>,
                        ...BUILTIN_VIDEO_MODES.filter(
                            id => !presetIds.includes(id),
                        ).map(id => (
                            <MenuItem key={id} value={id}>
                                {id}
                            </MenuItem>
                        )),
                    ]}
                </Select>
            </FormControl>
            {isCustom ? (
                <FormHelperText>
                    {t('config.simple.resolution.customNote')}
                </FormHelperText>
            ) : (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {t('config.simple.resolution.help')}
                </Typography>
            )}
        </Stack>
    );
};
