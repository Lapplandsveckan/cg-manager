import React, { useEffect, useRef, useState } from 'react';
import {
    Box,
    ButtonBase,
    IconButton,
    Stack,
    Tooltip,
    Typography,
    alpha,
} from '@mui/material';
import VideocamOffRoundedIcon from '@mui/icons-material/VideocamOffRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useTranslation } from 'react-i18next';
import { useLiveChannels } from '../lib/query/caspar';
import {
    getStorageItem,
    removeStorageItem,
    setStorageItem,
} from '../lib/storage';
import { ChannelPreview } from './ChannelPreview';

const STORAGE_KEY = 'rundown-preview-channel';

export const RundownPreview: React.FC = () => {
    const { t } = useTranslation('common');
    const channels = useLiveChannels();
    const [selected, setSelected] = useState<number | null>(null);
    const hydratedRef = useRef(false);

    useEffect(() => {
        if (!channels) return;

        if (!hydratedRef.current) {
            // Restore last pick only after channels arrive; avoids opening WHEP for a vanished channel
            hydratedRef.current = true;
            const raw = getStorageItem(STORAGE_KEY);
            const stored = raw ? Number(raw) : NaN;
            if (Number.isInteger(stored) && channels.includes(stored))
                setSelected(stored);
            return;
        }

        setSelected(current =>
            current != null && !channels.includes(current) ? null : current,
        );
    }, [channels]);

    const updateSelected = (next: number | null) => {
        setSelected(next);
        if (next == null) removeStorageItem(STORAGE_KEY);
        else setStorageItem(STORAGE_KEY, String(next));
    };

    const pickChannel = (ch: number) => {
        updateSelected(ch === selected ? null : ch);
    };

    if (!channels) return null;

    const offline = channels.length === 0;

    return (
        <Box
            sx={theme => ({
                flexShrink: 0,
                mx: 1,
                mb: 1,
                borderTop: `1px solid ${theme.palette.divider}`,
            })}
        >
            <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap={1}
                sx={{ pl: 0, pr: 1.5, py: 1.25 }}
            >
                <Typography variant="h6" sx={{ color: 'text.secondary' }}>
                    {t('actions.preview')}
                </Typography>
                <Stack direction="row" alignItems="center" gap={0.75}>
                    {channels.map(ch => {
                        const active = ch === selected;
                        return (
                            <Tooltip
                                key={ch}
                                title={
                                    active
                                        ? t('rundown.preview.stopChannel', {
                                              channel: ch,
                                          })
                                        : t('rundown.preview.previewChannel', {
                                              channel: ch,
                                          })
                                }
                            >
                                <ButtonBase
                                    onClick={() => pickChannel(ch)}
                                    sx={theme => ({
                                        minWidth: 28,
                                        height: 26,
                                        px: 1,
                                        borderRadius: 1,
                                        border: `1px solid ${active ? theme.palette.primary.main : theme.palette.divider}`,
                                        bgcolor: active
                                            ? alpha(
                                                  theme.palette.primary.main,
                                                  0.16,
                                              )
                                            : 'transparent',
                                        color: active
                                            ? theme.palette.primary.main
                                            : 'text.secondary',
                                        fontSize: '0.8125rem',
                                        fontWeight: 600,
                                        transition: theme.transitions.create(
                                            [
                                                'background-color',
                                                'border-color',
                                                'color',
                                            ],
                                            { duration: 120 },
                                        ),
                                        '&:hover': {
                                            borderColor:
                                                theme.palette.primary.main,
                                            color: theme.palette.primary.main,
                                        },
                                    })}
                                >
                                    {ch}
                                </ButtonBase>
                            </Tooltip>
                        );
                    })}
                    {selected != null && (
                        <Tooltip title={t('rundown.preview.stop')}>
                            <IconButton
                                size="small"
                                onClick={() => updateSelected(null)}
                                sx={{ color: 'text.secondary', ml: 0.5 }}
                            >
                                <CloseRoundedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                        </Tooltip>
                    )}
                </Stack>
            </Stack>

            <Box
                sx={theme => ({
                    position: 'relative',
                    aspectRatio: '16 / 9',
                    bgcolor: '#0c0d10',
                    borderTop: `1px solid ${theme.palette.divider}`,
                    overflow: 'hidden',
                })}
            >
                {offline ? (
                    <Stack
                        spacing={0.5}
                        sx={{
                            position: 'absolute',
                            inset: 0,
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'text.disabled',
                            textAlign: 'center',
                            px: 2,
                        }}
                    >
                        <VideocamOffRoundedIcon fontSize="small" />
                        <Typography variant="caption">
                            {t('rundown.preview.offline')}
                        </Typography>
                    </Stack>
                ) : selected != null ? (
                    <ChannelPreview channel={selected} objectFit="contain" />
                ) : (
                    <Stack
                        spacing={0.5}
                        sx={{
                            position: 'absolute',
                            inset: 0,
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'text.disabled',
                        }}
                    >
                        <VideocamOffRoundedIcon fontSize="small" />
                        <Typography variant="caption">
                            {t('rundown.preview.pickChannel')}
                        </Typography>
                    </Stack>
                )}
            </Box>
        </Box>
    );
};
