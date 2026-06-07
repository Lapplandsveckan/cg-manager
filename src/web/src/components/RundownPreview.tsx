import React, { useEffect, useState } from 'react';
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
import { useTranslation } from 'next-i18next';
import { useSocket } from '../lib/hooks/useSocket';
import {
    getStorageItem,
    removeStorageItem,
    setStorageItem,
} from '../lib/storage';
import { ChannelPreview } from './ChannelPreview';

const STORAGE_KEY = 'rundown-preview-channel';

/**
 * Compact preview card meant to live at the bottom of the side column on
 * the rundowns page. Shows one channel at a time — operators flip between
 * them with the chips in the header. Picking the same chip again, or
 * hitting ×, disables preview entirely (no encoder spun up). The choice
 * is persisted in localStorage so an operator who's set up their workspace
 * doesn't have to re-pick on reload.
 *
 * Renders nothing when CasparCG reports zero channels.
 */
export const RundownPreview: React.FC = () => {
    const { t } = useTranslation('common');
    const socket = useSocket();
    const [channels, setChannels] = useState<number[] | null>(null);
    const [selected, setSelected] = useState<number | null>(null);

    // Track *live* channels — what CasparCG is actually serving right now,
    // not what's on disk. The chip list shrinks/grows when CasparCG is
    // started or restarted with a different config. Empty when CasparCG
    // is stopped, so the operator can't try to preview something that
    // physically isn't running.
    useEffect(() => {
        if (!socket) return;
        let cancelled = false;
        let hydrated = false;

        const applyConfig = (
            cfg: { channels: { videoMode: string }[] } | null,
        ) => {
            if (cancelled) return;
            const list = cfg ? cfg.channels.map((_, i) => i + 1) : [];
            setChannels(list);

            if (!hydrated) {
                // First config arriving — restore the operator's last pick
                // if it's still valid. Doing this here (not on mount) means
                // we never momentarily open a WHEP session for a channel
                // that no longer exists.
                hydrated = true;
                const raw = getStorageItem(STORAGE_KEY);
                const stored = raw ? Number(raw) : NaN;
                if (Number.isInteger(stored) && list.includes(stored))
                    setSelected(stored);
                return;
            }

            setSelected(current =>
                current != null && !list.includes(current) ? null : current,
            );
        };

        socket.caspar
            .getRunningConfig()
            .then(applyConfig)
            .catch(() => applyConfig(null));

        const listener = (cfg: { channels: { videoMode: string }[] } | null) =>
            applyConfig(cfg);
        socket.caspar.on('running-config', listener);

        return () => {
            cancelled = true;
            socket.caspar.off('running-config', listener);
        };
    }, [socket]);

    const updateSelected = (next: number | null) => {
        setSelected(next);
        if (next == null) removeStorageItem(STORAGE_KEY);
        else setStorageItem(STORAGE_KEY, String(next));
    };

    const pickChannel = (ch: number) => {
        // Clicking the active chip turns preview off — saves an extra
        // explicit "close" interaction for the common "I'm done glancing"
        // case while still keeping × available for discoverability.
        updateSelected(ch === selected ? null : ch);
    };

    if (!channels) return null;

    const offline = channels.length === 0;

    // Plain Box (no Card chrome) so the preview reads as a section of the
    // column rather than a floating panel — only the top hairline visually
    // separates it from the scrollable injections above. Matching 8px
    // breathing room on the sides and bottom (`mx`+`mb: 1`) makes the
    // inset symmetric: same gap to the column edge horizontally as the
    // gap to the page bottom vertically.
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
                // Header label flush with the column's left edge (= the
                // video box's left edge below). Right side still gets a
                // little breathing room so the chips don't touch the edge.
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
                    // Placeholder so the slot doesn't read as a frozen preview
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
                    // WHEP session is opened/closed by ChannelPreview's mount/unmount effect
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
