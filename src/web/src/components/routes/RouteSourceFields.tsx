import React, { useEffect, useState } from 'react';
import {
    Autocomplete,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
} from '@mui/material';
import { MuiColorInput } from 'mui-color-input';
import { useTranslation } from 'next-i18next';
import { useSocket } from '../../lib/hooks/useSocket';
import { type VideoRouteSource } from '../../lib/api/videoRoutes';
import { type MediaDoc } from '../../lib/api/caspar';
import { MediaSelect } from '../MediaSelectPicker';
import { BUILTIN_VIDEO_MODES } from '../../lib/videoModes';
import type { SourceType } from './RouteSourceTypePicker';

export type DraftSource =
    | { type: 'decklink'; device: string; format: string; keyDevice: string }
    | { type: 'video'; video: string }
    | { type: 'channel'; channel: string }
    | { type: 'color'; color: string };

export function defaultSourceFor(type: SourceType): DraftSource {
    switch (type) {
        case 'decklink':
            return {
                type: 'decklink',
                device: '1',
                format: '1080i5000',
                keyDevice: '',
            };
        case 'video':
            return { type: 'video', video: '' };
        case 'channel':
            return { type: 'channel', channel: '1' };
        case 'color':
            return { type: 'color', color: '#000000' };
    }
}

export function sourceToDraft(src: VideoRouteSource): DraftSource {
    switch (src.type) {
        case 'decklink':
            return {
                type: 'decklink',
                device: String(src.device),
                format: src.format,
                keyDevice:
                    src.keyDevice !== undefined ? String(src.keyDevice) : '',
            };
        case 'video':
            return { type: 'video', video: src.video };
        case 'channel':
            return { type: 'channel', channel: String(src.channel) };
        case 'color':
            return { type: 'color', color: src.color };
    }
}

// CasparCG accepts colors as `#AARRGGBB` (alpha first). MuiColorInput speaks
// `#RRGGBBAA` (alpha last) when configured for hex8. These swap between the
// two representations so we store CG-native and display picker-native.
function casparColorToHex8(input: string): string {
    if (!input.startsWith('#')) return '#000000ff';
    const hex = input.slice(1);
    if (hex.length === 3) {
        const [r, g, b] = hex;
        return `#${r}${r}${g}${g}${b}${b}ff`;
    }
    if (hex.length === 6) return `#${hex}ff`;
    if (hex.length === 8) return `#${hex.slice(2)}${hex.slice(0, 2)}`;
    return '#000000ff';
}

function hex8ToCasparColor(input: string): string {
    if (!input.startsWith('#')) return input;
    const hex = input.slice(1);
    if (hex.length === 6) return `#${hex}`;
    if (hex.length === 8) {
        const rgb = hex.slice(0, 6);
        const a = hex.slice(6, 8);
        return `#${a}${rgb}`;
    }
    return input;
}

interface SourceFieldsProps {
    draft: DraftSource;
    channels: number[];
    videoModes: string[];
    // State-setter (rather than a plain onChange) so callbacks can use
    // functional updates. The Autocomplete in the decklink branch fires
    // `onInputChange` once at unmount when the source type changes; without
    // a functional update reading current state, that stale fire overwrites
    // the just-set new-type draft and the modal sticks on decklink.
    setDraft: React.Dispatch<React.SetStateAction<DraftSource>>;
}

export const SourceFields: React.FC<SourceFieldsProps> = ({
    draft,
    channels,
    videoModes,
    setDraft,
}) => {
    const { t } = useTranslation('common');
    const socket = useSocket();
    const [videoClip, setVideoClip] = useState<MediaDoc | null>(null);
    const videoId = draft.type === 'video' ? draft.video : '';

    // For the video source, resolve the persisted media id to a full MediaDoc
    // so MediaSelect can render the thumbnail card. Falls back to a stub doc
    // (just the id) if we can't find a match — picker still works, the
    // preview just won't have a thumb.
    useEffect(() => {
        if (!socket) return;
        if (draft.type !== 'video') {
            setVideoClip(null);
            return;
        }
        if (!videoId) {
            setVideoClip(null);
            return;
        }
        let cancelled = false;
        socket.caspar
            .getMedia()
            .then(m => {
                if (cancelled) return;
                const match = m.get(videoId);
                setVideoClip(match ?? ({ id: videoId } as MediaDoc));
            })
            .catch(() => {
                if (!cancelled) setVideoClip({ id: videoId } as MediaDoc);
            });
        return () => {
            cancelled = true;
        };
    }, [socket, draft.type, videoId]);

    // Type-guarded functional update: only patches the draft if the *current*
    // type still matches. Prevents stale callbacks (e.g. Autocomplete's
    // unmount fire) from reverting the source type.
    const patch = <T extends DraftSource['type']>(
        type: T,
        update: (
            prev: Extract<DraftSource, { type: T }>,
        ) => Extract<DraftSource, { type: T }>,
    ) =>
        setDraft(prev =>
            prev.type === type
                ? update(prev as Extract<DraftSource, { type: T }>)
                : prev,
        );

    if (draft.type === 'decklink') {
        // Video modes come from the CG config; if none are configured yet we
        // fall back to a small set of common ones so the dropdown isn't
        // empty on first run. freeSolo via Autocomplete also lets users type
        // a custom mode CasparCG supports but the host config doesn't know
        // about.
        const modes = videoModes.length > 0 ? videoModes : BUILTIN_VIDEO_MODES;
        return (
            <Stack direction="row" gap={1.5} flexWrap="wrap">
                <TextField
                    label={t('videoRoutes.fields.device')}
                    size="small"
                    type="number"
                    value={draft.device}
                    onChange={e =>
                        patch('decklink', p => ({
                            ...p,
                            device: e.target.value,
                        }))
                    }
                    inputProps={{ step: 1, min: 1 }}
                    sx={{ flex: '1 1 120px' }}
                />
                <Autocomplete
                    size="small"
                    freeSolo
                    options={modes}
                    value={draft.format}
                    onInputChange={(_, v) =>
                        patch('decklink', p => ({ ...p, format: v ?? '' }))
                    }
                    sx={{ flex: '2 1 220px' }}
                    renderInput={params => (
                        <TextField
                            {...params}
                            label={t('videoRoutes.fields.format')}
                            placeholder="1080i5000"
                        />
                    )}
                />
                <TextField
                    label={t('videoRoutes.fields.keyDeviceOptional')}
                    size="small"
                    type="number"
                    value={draft.keyDevice}
                    onChange={e =>
                        patch('decklink', p => ({
                            ...p,
                            keyDevice: e.target.value,
                        }))
                    }
                    inputProps={{ step: 1, min: 1 }}
                    sx={{ flex: '1 1 160px' }}
                />
            </Stack>
        );
    }

    if (draft.type === 'video')
        return (
            <MediaSelect
                clip={videoClip}
                onClipSelect={clip =>
                    setDraft({ type: 'video', video: clip.id })
                }
            />
        );

    if (draft.type === 'channel')
        return (
            <FormControl size="small" fullWidth>
                <InputLabel>{t('videoRoutes.fields.channel')}</InputLabel>
                <Select
                    label={t('videoRoutes.fields.channel')}
                    value={draft.channel}
                    onChange={e =>
                        patch('channel', p => ({
                            ...p,
                            channel: String(e.target.value),
                        }))
                    }
                >
                    {channels.map(ch => (
                        <MenuItem key={ch} value={String(ch)}>
                            {ch}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
        );

    if (draft.type === 'color') {
        const hex8 = casparColorToHex8(draft.color);
        return (
            <MuiColorInput
                label={t('videoRoutes.fields.color')}
                size="small"
                fullWidth
                format="hex8"
                value={hex8}
                onChange={v =>
                    patch('color', p => ({ ...p, color: hex8ToCasparColor(v) }))
                }
                helperText={t('videoRoutes.fields.colorHelper')}
            />
        );
    }

    return null;
};
