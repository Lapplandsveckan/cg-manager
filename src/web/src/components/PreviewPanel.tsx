import React, {useEffect, useRef, useState} from 'react';
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

const wsUrlForChannel = (channel: number, nonce: number): string => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/preview-ws/${channel}?t=${nonce}`;
};

const PreviewCard: React.FC<PreviewCardProps> = ({channel, running}) => {
    const [enabled, setEnabled] = useState(false);
    // Bump on each (re)load — used in the WS URL so a Retry forces a fresh
    // upgrade rather than reusing whatever the browser cached.
    const [reloadKey, setReloadKey] = useState(0);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const videoRef = useRef<HTMLVideoElement | null>(null);

    // Server going offline mid-preview won't reliably fire mpegts.js error
    // (the WS just stalls or closes silently). Auto-disable so the UI doesn't
    // sit on a frozen frame pretending it's live.
    useEffect(() => {
        if (!running && enabled) {
            setEnabled(false);
            setLoaded(false);
            setError(null);
        }
    }, [running, enabled]);

    const live = enabled && running;

    // Spin up the mpegts.js player whenever we transition into a live state.
    // The dynamic import isolates the (browser-only) library from Next's SSR
    // pass; the cleanup tears everything down on toggle-off / unmount.
    useEffect(() => {
        if (!live) return;

        let cancelled = false;
        let player: any = null;

        (async () => {
            const mpegts = (await import('mpegts.js')).default;
            if (cancelled) return;
            if (!mpegts.isSupported()) {
                setError('Your browser does not support MSE — preview unavailable here.');
                return;
            }

            const url = wsUrlForChannel(channel, reloadKey);

            try {
                player = mpegts.createPlayer({
                    type: 'mpegts',
                    isLive: true,
                    url,
                }, {
                    enableWorker: true,
                    // MSE buffers grow whenever the network/decoder gets
                    // ahead of playback; without aggressive chasing the
                    // preview drifts seconds behind within a minute. The
                    // server-side encoder shoots one keyframe per second
                    // (`-g:v 15` @ 15fps) so the chaser always has a sync
                    // point close to the live edge to jump to.
                    liveBufferLatencyChasing: true,
                    liveBufferLatencyChasingOnPaused: true,
                    liveBufferLatencyMaxLatency: 0.5,
                    liveBufferLatencyMinRemain: 0.1,
                    // Also drop any data still buffered on the loader side
                    // — keeps the source <-> demuxer pipeline tight.
                    stashInitialSize: 16,
                    autoCleanupSourceBuffer: true,
                    autoCleanupMaxBackwardDuration: 3,
                    autoCleanupMinBackwardDuration: 2,
                });

                player.on(mpegts.Events.ERROR, (type: string, detail: string) => {
                    if (cancelled) return;
                    setError(`${type}: ${detail}`);
                });

                const video = videoRef.current;
                if (!video) return;

                player.attachMediaElement(video);
                player.load();
                player.play().catch((e: Error) => { if (!cancelled) setError(e.message); });
            } catch (e) {
                if (!cancelled) setError((e as Error).message ?? 'Failed to start preview');
            }
        })();

        return () => {
            cancelled = true;
            if (player) {
                // mpegts.js throws if you call lifecycle methods out of
                // order (e.g. destroy before unload). Wrap each so cleanup
                // is always best-effort.
                try { player.pause(); } catch { /* noop */ }
                try { player.unload(); } catch { /* noop */ }
                try { player.detachMediaElement(); } catch { /* noop */ }
                try { player.destroy(); } catch { /* noop */ }
            }
        };
    }, [live, channel, reloadKey]);

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
                    <Box
                        component="video"
                        ref={videoRef}
                        muted
                        autoPlay
                        playsInline
                        onLoadedData={() => setLoaded(true)}
                        sx={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            // Hide the partially-rendered video element until
                            // the first frame arrives; the placeholder/spinner
                            // covers the gap during encoder warm-up.
                            visibility: live && loaded && !error ? 'visible' : 'hidden',
                        }}
                    />

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

                    {live && !loaded && !error && (
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
                        Low-latency MPEG-TS preview over WebSocket. Enabling spins up a per-client
                        H.264 encoder on the channel — leave off when you don't need it.
                    </Typography>
                </Stack>
                <Stack direction="row" gap={2} flexWrap="wrap">
                    {channels.map((ch) => <PreviewCard key={ch} channel={ch} running={running} />)}
                </Stack>
            </Stack>
        </Card>
    );
};
