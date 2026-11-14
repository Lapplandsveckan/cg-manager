import type dgram from 'dgram';
import { type RTCPeerConnection } from 'werift';
import { noTry, noTryAsync } from 'no-try';
import { Logger } from '../../../util/log';
import {
    H264_KEYFRAME_REQUEST_CODEC,
    H264_PAYLOAD_TYPE,
    OPUS_CODEC,
    OPUS_PAYLOAD_TYPE,
} from '../shared/codecs';
import { createPeerConnection, pinHostCandidates } from '../shared/peer';
import { bindUdp } from '../shared/ports';
import { startPipeline, type Pipeline } from './pipeline';
import { type IngestSink } from './sinks';

const logger = Logger.scope('Ingest');

export interface SessionPlan {
    sink: IngestSink;
    wantsAudio: boolean;
    videoPort: number;
    audioPort: number;
    sinkPort: number;
    stunServer?: string | null;
}

export interface SessionHandles {
    pc: RTCPeerConnection;
    rtpSocket: dgram.Socket;
    pipeline: Pipeline;
    stopKeyframeRequests: () => void;
}

export interface SessionHooks {
    onFirstPacket(): void;
    onPipelineExit(): void;
}

export async function buildSession(
    id: string,
    sdpOffer: string,
    plan: SessionPlan,
    hooks: SessionHooks,
): Promise<{ sdpAnswer: string; handles: SessionHandles }> {
    const rollback: Array<() => unknown> = [];
    const unwind = async () => {
        for (const undo of rollback.reverse())
            await noTryAsync(async () => undo());
    };

    const [err, built] = await noTryAsync(async () => {
        const { socket: rtpSocket } = await bindUdp();
        rollback.push(() => rtpSocket.close());

        // Started before the peer so ffmpeg is already bound when the first
        // RTP arrives, mirroring the preview path's bind-before-ADD ordering.
        const pipeline = await startPipeline(
            id,
            {
                video: plan.videoPort,
                audio: plan.wantsAudio ? plan.audioPort : undefined,
                sink: plan.sinkPort,
            },
            plan.sink,
            hooks.onPipelineExit,
        );
        rollback.push(() => pipeline.close());

        const pc = await createPeerConnection(
            {
                video: [H264_KEYFRAME_REQUEST_CODEC],
                ...(plan.wantsAudio ? { audio: [OPUS_CODEC] } : {}),
            },
            plan.stunServer,
        );
        rollback.push(() => pc.close());

        forwardRtp(pc, rtpSocket, plan, hooks);

        const stopKeyframeRequests = requestKeyframes(pc);
        rollback.push(stopKeyframeRequests);

        await pc.setRemoteDescription({ type: 'offer', sdp: sdpOffer });
        // Transceivers exist only now, and gathering starts just below.
        pinHostCandidates(pc, plan.stunServer);
        await pc.setLocalDescription(await pc.createAnswer());

        const sdpAnswer = pc.localDescription?.sdp;
        if (!sdpAnswer)
            throw new Error('werift failed to produce an SDP answer');

        return {
            sdpAnswer,
            handles: { pc, rtpSocket, pipeline, stopKeyframeRequests },
        };
    });

    if (err) {
        await unwind();
        throw err;
    }

    return built;
}

const KEYFRAME_INTERVAL_MS = 2000;

// A browser only sends a keyframe when asked, and `-c:v copy` means whoever
// starts reading the sink shows nothing until the next one.
function requestKeyframes(pc: RTCPeerConnection): () => void {
    let videoSsrc: number | undefined;

    pc.onTrack.subscribe(track => {
        if (track.kind !== 'video') return;

        track.onReceiveRtp.once(packet => {
            videoSsrc = packet.header.ssrc;
        });
    });

    const timer = setInterval(() => {
        if (videoSsrc === undefined) return;

        const video = pc.getTransceivers().find(t => t.kind === 'video');
        video?.receiver
            .sendRtcpPLI(videoSsrc)
            .catch(e => logger.debug(`Keyframe request failed: ${e}`));
    }, KEYFRAME_INTERVAL_MS);

    return () => clearInterval(timer);
}

/** Browser-offered m-lines become recvonly transceivers, so tracks arrive here
 *  rather than being added by us.
 *
 *  The payload type is rewritten on the way out: SDP offer/answer makes the
 *  *offerer's* numbering authoritative, so a browser's H.264 can land on any
 *  dynamic PT (Chrome commonly picks 102/106/127). ffmpeg reads a static SDP,
 *  so normalising here is what keeps the two ends agreeing. */
function forwardRtp(
    pc: RTCPeerConnection,
    rtpSocket: dgram.Socket,
    plan: SessionPlan,
    hooks: SessionHooks,
): void {
    let seen = false;

    pc.onTrack.subscribe(track => {
        const audio = track.kind === 'audio';
        const port = audio ? plan.audioPort : plan.videoPort;
        const payloadType = audio ? OPUS_PAYLOAD_TYPE : H264_PAYLOAD_TYPE;

        track.onReceiveRtp.subscribe(packet => {
            packet.header.payloadType = payloadType;

            const [sendErr] = noTry(() =>
                rtpSocket.send(packet.serialize(), port, '127.0.0.1'),
            );
            if (sendErr)
                return logger.warn(`RTP forward failed: ${sendErr.message}`);

            if (seen) return;
            seen = true;
            hooks.onFirstPacket();
        });
    });
}
