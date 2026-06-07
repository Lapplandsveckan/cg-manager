import React, { useEffect, useRef, useState } from 'react';
import { noTry, noTryAsync } from 'no-try';
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
import { useTranslation } from 'next-i18next';
import { useSocket } from '../lib/hooks/useSocket';
import { type CasparStatus } from '../lib/api/caspar';

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

const ViewportPlaceholder: React.FC<ViewportPlaceholderProps> = ({
    icon,
    title,
    detail,
    action,
}) => (
    <Stack
        spacing={1}
        sx={{
            position: 'absolute',
            inset: 0,
            alignItems: 'center',
            justifyContent: 'center',
            p: 2,
        }}
    >
        <Box sx={{ color: 'text.disabled' }}>{icon}</Box>
        <Typography
            variant="body2"
            sx={{ color: 'text.secondary', textAlign: 'center' }}
        >
            {title}
        </Typography>
        {detail && (
            <Typography
                variant="caption"
                sx={{ color: 'text.disabled', textAlign: 'center' }}
            >
                {detail}
            </Typography>
        )}
        {action}
    </Stack>
);

const whepUrlForChannel = (channel: number, nonce: number): string =>
    `/preview-whep/${channel}?t=${nonce}`;

/** Standard WHEP exchange: POST the local SDP offer, server replies with the
 *  SDP answer. No DataChannel, no ICE-restart, no DELETE — keep alive until
 *  the peer connection itself closes. */
async function whepExchange(
    channel: number,
    offerSdp: string,
    nonce: number,
    signal: AbortSignal,
): Promise<string> {
    const resp = await fetch(whepUrlForChannel(channel, nonce), {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: offerSdp,
        signal,
    });
    if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`WHEP ${resp.status}: ${text || resp.statusText}`);
    }
    return resp.text();
}

const PreviewCard: React.FC<PreviewCardProps> = ({ channel, running }) => {
    const { t } = useTranslation('common');
    const [enabled, setEnabled] = useState(false);
    // Bump on each (re)load — used in the URL so a Retry forces a fresh
    // exchange rather than reusing whatever the browser/proxy might cache.
    const [reloadKey, setReloadKey] = useState(0);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const videoRef = useRef<HTMLVideoElement | null>(null);

    // Server going offline mid-preview won't always close the PC instantly
    // (ICE has its own timeout). Auto-disable on caspar-status:false so the
    // UI doesn't sit on a frozen frame pretending it's live.
    useEffect(() => {
        if (!running && enabled) {
            setEnabled(false);
            setLoaded(false);
            setError(null);
        }
    }, [running, enabled]);

    const live = enabled && running;

    // Spin up a WebRTC peer connection whenever we transition into a live
    // state. WHEP-style SDP exchange against the manager's `/preview-whep/:ch`
    // endpoint. Sub-second latency H.264 over WebRTC.
    useEffect(() => {
        if (!live) return;

        const abort = new AbortController();
        let pc: RTCPeerConnection | null = null;

        (async () => {
            const [e] = await noTryAsync(async () => {
                pc = new RTCPeerConnection();
                pc.addTransceiver('video', { direction: 'recvonly' });

                pc.ontrack = event => {
                    const video = videoRef.current;
                    if (!video) return;
                    video.srcObject =
                        event.streams[0] ?? new MediaStream([event.track]);
                };

                pc.onconnectionstatechange = () => {
                    if (!pc || abort.signal.aborted) return;
                    if (pc.connectionState === 'failed')
                        setError(t('media.preview.errors.failed'));
                    if (pc.connectionState === 'disconnected')
                        setError(t('media.preview.errors.disconnected'));
                };

                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);

                const answerSdp = await whepExchange(
                    channel,
                    offer.sdp ?? '',
                    reloadKey,
                    abort.signal,
                );
                if (abort.signal.aborted) return;

                await pc.setRemoteDescription({
                    type: 'answer',
                    sdp: answerSdp,
                });
            });

            if (e) {
                if (abort.signal.aborted) return;
                setError(
                    (e as Error).message ??
                        t('media.preview.errors.startFailed'),
                );
            }
        })();

        return () => {
            abort.abort();
            if (pc) {
                noTry(() => pc.getSenders().forEach(s => s.track?.stop()));
                noTry(() => pc.close());
            }
            const video = videoRef.current;
            if (video) video.srcObject = null;
        };
    }, [live, channel, reloadKey]);

    const handleToggle = (next: boolean) => {
        setEnabled(next);
        setError(null);
        setLoaded(false);
        if (next) setReloadKey(k => k + 1);
    };

    const retry = () => {
        setError(null);
        setLoaded(false);
        setReloadKey(k => k + 1);
    };

    const switchLabel = !running
        ? t('media.preview.switch.serverOff')
        : enabled
          ? t('media.preview.switch.live')
          : t('media.preview.switch.off');

    return (
        <Card sx={{ p: 2, flex: '1 1 320px', minWidth: 280, maxWidth: 480 }}>
            <Stack spacing={1.5}>
                <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                >
                    <Typography variant="h4">
                        {t('media.preview.channel', { channel })}
                    </Typography>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={enabled}
                                disabled={!running}
                                onChange={e => handleToggle(e.target.checked)}
                            />
                        }
                        label={switchLabel}
                        labelPlacement="start"
                        sx={{
                            m: 0,
                            '& .MuiFormControlLabel-label': {
                                color: 'text.secondary',
                            },
                        }}
                    />
                </Stack>
                <Box
                    sx={theme => ({
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
                            // covers the gap during DTLS/ICE handshake.
                            visibility:
                                live && loaded && !error ? 'visible' : 'hidden',
                        }}
                    />

                    {!running && (
                        <ViewportPlaceholder
                            icon={<VideocamOffRoundedIcon fontSize="large" />}
                            title={t(
                                'media.preview.placeholder.notRunning.title',
                            )}
                            detail={t(
                                'media.preview.placeholder.notRunning.detail',
                            )}
                        />
                    )}

                    {running && !enabled && (
                        <ViewportPlaceholder
                            icon={<VideocamOffRoundedIcon fontSize="large" />}
                            title={t('media.preview.placeholder.off.title')}
                            detail={t('media.preview.placeholder.off.detail')}
                        />
                    )}

                    {running && enabled && error && (
                        <ViewportPlaceholder
                            icon={
                                <WarningAmberRoundedIcon
                                    fontSize="large"
                                    color="warning"
                                />
                            }
                            title={t('media.preview.placeholder.failed.title')}
                            detail={error}
                            action={
                                <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={retry}
                                >
                                    {t('actions.retry')}
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
                            <Typography
                                variant="caption"
                                sx={{ color: 'text.disabled' }}
                            >
                                {t('actions.loading')}
                            </Typography>
                        </Stack>
                    )}
                </Box>
            </Stack>
        </Card>
    );
};

export const PreviewPanel: React.FC = () => {
    const { t } = useTranslation('common');
    const socket = useSocket();
    const [channels, setChannels] = useState<number[] | null>(null);
    const [running, setRunning] = useState(false);

    useEffect(() => {
        if (!socket) return;
        let cancelled = false;

        // Track live (running) channels rather than the saved config — if
        // CasparCG is off or starts with a different channel set we don't
        // want to render preview cards for things that physically aren't
        // there.
        const apply = (cfg: { channels: { videoMode: string }[] } | null) => {
            if (cancelled) return;
            setChannels(cfg ? cfg.channels.map((_, i) => i + 1) : []);
        };

        socket.caspar
            .getRunningConfig()
            .then(apply)
            .catch(() => apply(null));

        const listener = (cfg: { channels: { videoMode: string }[] } | null) =>
            apply(cfg);
        socket.caspar.on('running-config', listener);

        return () => {
            cancelled = true;
            socket.caspar.off('running-config', listener);
        };
    }, [socket]);

    useEffect(() => {
        if (!socket) return;
        const listener = (s: CasparStatus) => setRunning(Boolean(s.running));
        socket.caspar.on('status', listener);
        socket.caspar
            .getStatus()
            .then(listener)
            .catch(() => setRunning(false));
        return () => {
            socket.caspar.off('status', listener);
        };
    }, [socket]);

    // null = initial fetch hasn't resolved yet (avoid a brief empty flash).
    // []   = CasparCG is off OR has no channels — render the panel chrome
    //        with an explanatory placeholder rather than disappearing.
    if (channels === null) return null;

    return (
        <Card sx={{ p: 3 }}>
            <Stack spacing={2}>
                <Stack spacing={0.5}>
                    <Typography variant="h3">
                        {t('media.preview.title')}
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{ color: 'text.secondary' }}
                    >
                        {t('media.preview.subtitle')}
                    </Typography>
                </Stack>
                {channels.length === 0 ? (
                    <Card
                        sx={theme => ({
                            p: 3,
                            bgcolor: theme.palette.surface.elevated,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                        })}
                    >
                        <VideocamOffRoundedIcon
                            sx={{ color: 'text.disabled', fontSize: 32 }}
                        />
                        <Stack spacing={0.25}>
                            <Typography variant="body1">
                                {t('media.preview.offline.title')}
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{ color: 'text.secondary' }}
                            >
                                {t('media.preview.offline.detail')}
                            </Typography>
                        </Stack>
                    </Card>
                ) : (
                    <Stack direction="row" gap={2} flexWrap="wrap">
                        {channels.map(ch => (
                            <PreviewCard
                                key={ch}
                                channel={ch}
                                running={running}
                            />
                        ))}
                    </Stack>
                )}
            </Stack>
        </Card>
    );
};
