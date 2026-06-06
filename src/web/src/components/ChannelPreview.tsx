import React, {useEffect, useRef, useState} from 'react';
import {Box, CircularProgress, Stack, Typography} from '@mui/material';
import {noTry, noTryAsync} from 'no-try';
import {useTranslation} from 'next-i18next';

interface ChannelPreviewProps {
    /** 1-based CasparCG channel number. Disabled when undefined/null. */
    channel: number | null | undefined;
    /** How the video fills its parent. `cover` for stage backdrops, `contain`
     *  for preview cards that need to show the whole frame. */
    objectFit?: 'contain' | 'cover';
    /** Called once when the first frame arrives. Useful for hiding spinners. */
    onReady?: () => void;
    /** Called with a message on WHEP/SDP/ICE failures. */
    onError?: (msg: string) => void;
}

async function whepExchange(channel: number, offerSdp: string, signal: AbortSignal): Promise<string> {
    // Nonce prevents intermediaries from caching the WHEP POST.
    const url = `/preview-whep/${channel}?t=${Math.floor(Math.random() * 1e9)}`;
    const resp = await fetch(url, {
        method: 'POST',
        headers: {'Content-Type': 'application/sdp'},
        body: offerSdp,
        signal,
    });
    if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`WHEP ${resp.status}: ${text || resp.statusText}`);
    }
    return resp.text();
}

/**
 * Embeds a single CasparCG channel's WebRTC preview. Mount = open session,
 * unmount = close it. The server-side PreviewManager tears down its consumer
 * automatically when our peer-connection state goes to closed/disconnected.
 *
 * Renders an absolutely-positioned `<video>` filling its parent — wrap in a
 * relatively-positioned container with whatever size you want.
 */
export const ChannelPreview: React.FC<ChannelPreviewProps> = ({channel, objectFit = 'cover', onReady, onError}) => {
    const {t} = useTranslation('common');
    const videoRef = useRef<HTMLVideoElement | null>(null);
    // Per-mount key; changing channel re-runs the effect cleanly. We also
    // include it in deps so the WebRTC session restarts when the prop flips.
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
                pc.addTransceiver('video', {direction: 'recvonly'});

                pc.ontrack = (event) => {
                    const video = videoRef.current;
                    if (!video) return;
                    video.srcObject = event.streams[0] ?? new MediaStream([event.track]);

                    // Tell the WebRTC stack to paint the first decodable
                    // frame immediately instead of building up its default
                    // 150–200ms jitter buffer. We're on LAN/loopback so the
                    // jitter the buffer would have absorbed isn't there to
                    // worry about. noTry because older browsers don't ship
                    // this hint and the property assignment throws.
                    noTry(() => { (event.receiver as any).playoutDelayHint = 0; });
                };

                pc.onconnectionstatechange = () => {
                    if (!pc || abort.signal.aborted) return;
                    if (pc.connectionState === 'failed') onError?.(t('media.preview.errors.failed'));
                    if (pc.connectionState === 'disconnected') onError?.(t('media.preview.errors.disconnected'));
                };

                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);

                const answer = await whepExchange(channel, offer.sdp ?? '', abort.signal);
                if (abort.signal.aborted) return;

                await pc.setRemoteDescription({type: 'answer', sdp: answer});
            });
            if (err && !abort.signal.aborted) onError?.(err.message ?? t('media.preview.errors.startFailed'));
        })();

        return () => {
            abort.abort();
            if (pc) noTry(() => pc.close());

            const video = videoRef.current;
            if (video) video.srcObject = null;
        };
    }, [channel, mountId, onError, t]);

    const active = channel != null && Number.isFinite(channel) && channel >= 1;

    return (
        <>
            <Box
                component="video"
                ref={videoRef}
                muted
                autoPlay
                playsInline
                onLoadedData={() => { setLoaded(true); onReady?.(); }}
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
                    <Typography variant="caption" sx={{color: 'text.disabled'}}>
                        {t('actions.loading')}
                    </Typography>
                </Stack>
            )}
        </>
    );
};
