import React, {useEffect, useState} from 'react';
import {
    Box,
    Button,
    Card,
    CircularProgress,
    FormControlLabel,
    Stack,
    Switch,
    Typography,
} from '@mui/material';
import VideocamOffRoundedIcon from '@mui/icons-material/VideocamOffRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import {useSocket} from '../lib/hooks/useSocket';
import {CasparStatus} from '../lib/api/caspar';

interface PreviewCardProps {
    channel: number;
    running: boolean;
}

interface ViewportPlaceholderProps {
    icon: React.ReactNode;
    title: string;
    detail?: string;
    action?: React.ReactNode;
}

const ViewportPlaceholder: React.FC<ViewportPlaceholderProps> = ({icon, title, detail, action}) => (
    <Stack
        spacing={1}
        sx={{position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', p: 2}}
    >
        <Box sx={{color: 'text.disabled'}}>{icon}</Box>
        <Typography variant="body2" sx={{color: 'text.secondary', textAlign: 'center'}}>
            {title}
        </Typography>
        {detail && (
            <Typography variant="caption" sx={{color: 'text.disabled', textAlign: 'center'}}>
                {detail}
            </Typography>
        )}
        {action}
    </Stack>
);

const PreviewCard: React.FC<PreviewCardProps> = ({channel, running}) => {
    const [enabled, setEnabled] = useState(false);
    // Bump on each (re)load to cache-bust the same URL and to force the
    // <img> element to remount, so the browser actually re-issues the GET.
    const [reloadKey, setReloadKey] = useState(0);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Server going offline mid-preview won't trigger img onError reliably
    // (the multipart connection just stalls). Auto-disable so the UI doesn't
    // sit on a frozen frame pretending it's live.
    useEffect(() => {
        if (!running && enabled) {
            setEnabled(false);
            setLoaded(false);
            setError(null);
        }
    }, [running, enabled]);

    const handleToggle = (next: boolean) => {
        setEnabled(next);
        setError(null);
        setLoaded(false);
        if (next) setReloadKey((k) => k + 1);
    };

    const retry = () => {
        setError(null);
        setLoaded(false);
        setReloadKey((k) => k + 1);
    };

    const live = enabled && running;
    const showImg = live && !error;

    const switchLabel = !running ? 'Server off' : enabled ? 'Live' : 'Off';

    return (
        <Card sx={{p: 2, flex: '1 1 320px', minWidth: 280, maxWidth: 480}}>
            <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="h4">Channel {channel}</Typography>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={enabled}
                                disabled={!running}
                                onChange={(e) => handleToggle(e.target.checked)}
                            />
                        }
                        label={switchLabel}
                        labelPlacement="start"
                        sx={{m: 0, '& .MuiFormControlLabel-label': {color: 'text.secondary'}}}
                    />
                </Stack>
                <Box
                    sx={(theme) => ({
                        position: 'relative',
                        aspectRatio: '16 / 9',
                        bgcolor: '#0c0d10',
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 1,
                        overflow: 'hidden',
                    })}
                >
                    {showImg && (
                        <Box
                            component="img"
                            // Key remount + cache-bust query so the browser
                            // doesn't reuse a previously aborted MJPEG stream.
                            key={reloadKey}
                            src={`/preview/${channel}?t=${reloadKey}`}
                            alt={`Channel ${channel} preview`}
                            onLoad={() => setLoaded(true)}
                            onError={() => setError(
                                'Preview unavailable — check that CasparCG is running and the channel exists.',
                            )}
                            sx={{
                                position: 'absolute',
                                inset: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                                // Hide the partially-rendered img until the
                                // first frame arrives — keeps the placeholder
                                // visible during the encoder warm-up.
                                visibility: loaded ? 'visible' : 'hidden',
                            }}
                        />
                    )}

                    {!running && (
                        <ViewportPlaceholder
                            icon={<VideocamOffRoundedIcon fontSize="large" />}
                            title="CasparCG is not running"
                            detail="Start the server to enable preview."
                        />
                    )}

                    {running && !enabled && (
                        <ViewportPlaceholder
                            icon={<VideocamOffRoundedIcon fontSize="large" />}
                            title="Preview off"
                            detail="Toggle Live to start streaming this channel."
                        />
                    )}

                    {running && enabled && error && (
                        <ViewportPlaceholder
                            icon={<WarningAmberRoundedIcon fontSize="large" color="warning" />}
                            title="Preview failed"
                            detail={error}
                            action={
                                <Button size="small" variant="outlined" onClick={retry}>
                                    Retry
                                </Button>
                            }
                        />
                    )}

                    {showImg && !loaded && (
                        <Stack
                            sx={{
                                position: 'absolute',
                                inset: 0,
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 1,
                            }}
                        >
                            <CircularProgress size={20} />
                            <Typography variant="caption" sx={{color: 'text.disabled'}}>
                                Starting encoder…
                            </Typography>
                        </Stack>
                    )}
                </Box>
            </Stack>
        </Card>
    );
};

export const PreviewPanel: React.FC = () => {
    const socket = useSocket();
    const [channels, setChannels] = useState<number[] | null>(null);
    const [running, setRunning] = useState(false);

    useEffect(() => {
        if (!socket) return;
        let cancelled = false;
        socket.caspar.getConfig()
            .then((cfg) => { if (!cancelled) setChannels(cfg.channels.map((_, i) => i + 1)); })
            .catch(() => { if (!cancelled) setChannels([]); });
        return () => { cancelled = true; };
    }, [socket]);

    useEffect(() => {
        if (!socket) return;
        const listener = (s: CasparStatus) => setRunning(Boolean(s.running));
        socket.caspar.on('status', listener);
        socket.caspar.getStatus().then(listener).catch(() => setRunning(false));
        return () => { socket.caspar.off('status', listener); };
    }, [socket]);

    if (channels === null || channels.length === 0) return null;

    return (
        <Card sx={{p: 3}}>
            <Stack spacing={2}>
                <Stack spacing={0.5}>
                    <Typography variant="h3">Preview</Typography>
                    <Typography variant="body2" sx={{color: 'text.secondary'}}>
                        Low-latency MJPEG preview. Enabling spins up a per-client ffmpeg encoder
                        on the channel — leave off when you don't need it.
                    </Typography>
                </Stack>
                <Stack direction="row" gap={2} flexWrap="wrap">
                    {channels.map((ch) => <PreviewCard key={ch} channel={ch} running={running} />)}
                </Stack>
            </Stack>
        </Card>
    );
};
