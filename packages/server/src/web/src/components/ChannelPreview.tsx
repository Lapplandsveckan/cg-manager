import React, { useEffect, useRef, useState } from 'react';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import { noTry, noTryAsync } from 'no-try';
import { useTranslation } from 'react-i18next';
import { useLatest } from '../lib/hooks/useLatest';

interface ChannelPreviewProps {
    channel: number | null | undefined;
    objectFit?: 'contain' | 'cover';
    onReady?: () => void;
    onError?: (msg: string) => void;
}

async function whepExchange(
    channel: number,
    offerSdp: string,
    signal: AbortSignal,
): Promise<string> {
    // Nonce prevents intermediaries from caching the WHEP POST.
    const url = `/preview-whep/${channel}?t=${Math.floor(Math.random() * 1e9)}`;
    const resp = await fetch(url, {
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

export const ChannelPreview: React.FC<ChannelPreviewProps> = ({
    channel,
    objectFit = 'cover',
    onReady,
    onError,
}) => {
    const { t } = useTranslation('common');
    const videoRef = useRef<HTMLVideoElement | null>(null);
    // Read via ref so a language switch does not restart a live peer connection
    const tRef = useLatest(t);
    const [mountId] = useState(() => Math.random());
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        setLoaded(false);
    }, [channel, mountId]);

    useEffect(() => {
        if (channel == null || !Number.isFinite(channel) || channel < 1) return;
        const abort = new AbortController();
        let pc: RTCPeerConnection | null = null;

        (async () => {
            const [err] = await noTryAsync(async () => {
                pc = new RTCPeerConnection();
                pc.addTransceiver('video', { direction: 'recvonly' });

                pc.ontrack = event => {
                    const video = videoRef.current;
                    if (!video) return;
                    video.srcObject =
                        event.streams[0] ?? new MediaStream([event.track]);

                    // Paint first frame immediately; older browsers throw on this hint, hence noTry
                    noTry(() => {
                        (
                            event.receiver as RTCRtpReceiver & {
                                playoutDelayHint?: number;
                            }
                        ).playoutDelayHint = 0;
                    });
                };

                pc.onconnectionstatechange = () => {
                    if (!pc || abort.signal.aborted) return;
                    if (pc.connectionState === 'failed')
                        onError?.(tRef.current('media.preview.errors.failed'));
                    if (pc.connectionState === 'disconnected')
                        onError?.(
                            tRef.current('media.preview.errors.disconnected'),
                        );
                };

                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);

                const answer = await whepExchange(
                    channel,
                    offer.sdp ?? '',
                    abort.signal,
                );
                if (abort.signal.aborted) return;

                await pc.setRemoteDescription({ type: 'answer', sdp: answer });
            });
            if (err && !abort.signal.aborted)
                onError?.(
                    err.message ??
                        tRef.current('media.preview.errors.startFailed'),
                );
        })();

        return () => {
            abort.abort();
            if (pc) noTry(() => pc.close());

            // Read at teardown, not hoisted: the mounted element is the one whose srcObject must be cleared
            // eslint-disable-next-line react-hooks/exhaustive-deps
            const video = videoRef.current;
            if (video) video.srcObject = null;
        };
    }, [channel, mountId, onError, tRef]);

    const active = channel != null && Number.isFinite(channel) && channel >= 1;

    return (
        <>
            <Box
                component="video"
                ref={videoRef}
                muted
                autoPlay
                playsInline
                onLoadedData={() => {
                    setLoaded(true);
                    onReady?.();
                }}
                sx={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit,
                    bgcolor: '#000',
                    pointerEvents: 'none',
                    visibility: loaded ? 'visible' : 'hidden',
                }}
            />
            {active && !loaded && (
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
        </>
    );
};
