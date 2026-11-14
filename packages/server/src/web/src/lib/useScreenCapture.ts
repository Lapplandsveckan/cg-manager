import { useCallback, useEffect, useRef, useState } from 'react';
import { noTry, noTryAsync } from 'no-try';
import { startThumbnailUploads } from './captureThumbnails';

export type CaptureState = 'idle' | 'starting' | 'live' | 'ended' | 'error';

interface CaptureOptions {
    /** WHIP endpoint the offer is POSTed to. */
    endpoint: string;
    audio?: boolean;
    /** Where to POST preview frames for this session, if anywhere. */
    thumbnailEndpoint?: (sessionId: string) => string;
}

/** The session id the host minted, so the sender can address its own session
 *  (WHIP's own `Location` addresses the resource, which has no DELETE here). */
const SESSION_HEADER = 'X-Ingest-Session';

interface WhipAnswer {
    sdpAnswer: string;
    sessionId: string | null;
}

async function whipExchange(
    endpoint: string,
    offerSdp: string,
    signal: AbortSignal,
): Promise<WhipAnswer> {
    const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: offerSdp,
        signal,
    });
    if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`WHIP ${resp.status}: ${text || resp.statusText}`);
    }

    return {
        sdpAnswer: await resp.text(),
        sessionId: resp.headers.get(SESSION_HEADER),
    };
}

/** Browser half of screen-share ingest: `getDisplayMedia` into a sendonly
 *  peer connection, offer POSTed to a WHIP endpoint. The mirror of
 *  `ChannelPreview`'s WHEP consumer. */
export function useScreenCapture({
    endpoint,
    audio = true,
    thumbnailEndpoint,
}: CaptureOptions) {
    const [state, setState] = useState<CaptureState>('idle');
    const [error, setError] = useState<string | null>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);

    const pcRef = useRef<RTCPeerConnection | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const thumbnailsRef = useRef<(() => void) | null>(null);

    const stop = useCallback(() => {
        abortRef.current?.abort();
        abortRef.current = null;

        thumbnailsRef.current?.();
        thumbnailsRef.current = null;

        const pc = pcRef.current;
        pcRef.current = null;
        if (pc) noTry(() => pc.close());

        setStream(current => {
            current?.getTracks().forEach(track => track.stop());

            return null;
        });
        // Never report 'ended' for a capture that never started.
        setState(current =>
            current === 'error' || current === 'idle' ? current : 'ended',
        );
    }, []);

    const start = useCallback(async () => {
        stop();
        setError(null);
        setState('starting');

        const abort = new AbortController();
        abortRef.current = abort;

        const [err] = await noTryAsync(async () => {
            const captured = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio,
            });
            if (abort.signal.aborted)
                return captured.getTracks().forEach(t => t.stop());

            const pc = new RTCPeerConnection();
            pcRef.current = pc;
            captured.getTracks().forEach(track => pc.addTrack(track, captured));

            // Stopping the share from the browser's own banner ends the session.
            captured.getVideoTracks()[0]?.addEventListener('ended', stop);

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            const answer = await whipExchange(
                endpoint,
                offer.sdp ?? '',
                abort.signal,
            );
            if (abort.signal.aborted) return;

            await pc.setRemoteDescription({
                type: 'answer',
                sdp: answer.sdpAnswer,
            });

            if (abort.signal.aborted) return;
            if (thumbnailEndpoint && answer.sessionId)
                thumbnailsRef.current = startThumbnailUploads(
                    captured,
                    thumbnailEndpoint(answer.sessionId),
                );

            setStream(captured);
            setState('live');
        });

        if (err && !abort.signal.aborted) {
            setError(err.message);
            setState('error');
            stop();
        }
    }, [audio, endpoint, stop, thumbnailEndpoint]);

    useEffect(() => stop, [stop]);

    return { state, error, stream, start, stop };
}
