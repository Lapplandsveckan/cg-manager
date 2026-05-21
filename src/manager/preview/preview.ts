import net from 'net';
import {BasicCommand} from '@lappis/cg-manager';
import {
    MediaStreamTrack,
    RTCPeerConnection,
    RTCRtpCodecParameters,
} from 'werift';
import {H264Packetizer} from './h264-packetizer';
import {Logger} from '../../util/log';
import {CasparExecutor} from '../caspar/executor';

const logger = Logger.scope('Preview');

// H.264 over RTP for WebRTC. Browser-friendly profile (Constrained Baseline,
// level 3.1, packetization-mode 1) — every major browser accepts this. We
// pin payloadType 96 so we can pass `-payload_type 96` to ffmpeg and get a
// matching wire format without parsing the generated SDP back. The SDP
// werift answers with will advertise exactly these parameters.
const WEBRTC_VIDEO_CODEC = new RTCRtpCodecParameters({
    mimeType: 'video/H264',
    clockRate: 90000,
    payloadType: 96,
    parameters: 'level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f',
});

// ffmpeg args for the WebRTC egress. We can't use the `rtp` muxer here
// because CasparCG's consumer unconditionally creates an audio Stream when
// `oformat->audio_codec != NONE` (the RTP muxer's default is PCM_MULAW)
// and the RTP muxer refuses multi-stream output. The `h264` muxer is
// video-only (audio_codec = NONE) so the consumer skips audio entirely;
// the manager then parses the raw Annex-B byte stream into NALUs and
// packetizes them as H.264/RTP itself.
//
// `format=yuv420p` HAS to be in the filter chain (not `-pix_fmt:v`): the
// consumer's buffersink offers every pixel format the encoder supports, and
// for BGRA input the scaler defaults to picking yuv444p (closest match, no
// chroma subsampling loss). libx264 then refuses Baseline profile because
// Baseline is 4:2:0 only — and Baseline is what every browser's WebRTC
// stack will accept. Forcing the filter chain to emit yuv420p makes the
// sink hand 4:2:0 frames straight through, satisfying libx264 + browsers.
const PREVIEW_FPS = 15;
const H264_PREVIEW_ARGS = [
    '-format',
    'h264',
    '-codec:v',
    'libx264',
    '-profile:v',
    'baseline',
    '-level:v',
    '3.1',
    '-preset:v',
    'ultrafast',
    '-tune:v',
    'zerolatency',
    '-bf:v',
    '0',
    '-g:v',
    String(PREVIEW_FPS),
    '-b:v',
    '800k',
    '-filter:v',
    `fps=${PREVIEW_FPS},scale=640:-2,format=yuv420p`,
];

// Consumer slot index for preview sessions starts well above the typical
// statically-configured consumers (which sit at 1..N from the XML). Each
// new session bumps the counter; CasparCG only cares about uniqueness
// within a channel but we make it globally unique for easier tracking.
let nextConsumerIndex = 100;

export interface PreviewSessionOptions {
    channel: number;
    /**
     * ffmpeg args appended after the STREAM URL. Drives the output
     * muxer/codec — e.g. `['-f', 'mpjpeg', '-q:v', '5']` for MJPEG over HTTP,
     * or `['-f', 'mpegts', '-c:v', 'libx264', '-tune', 'zerolatency']` for
     * the WebSocket path. Pre-tokenised so `BasicCommand.construct` can
     * pass each as a separate AMCP arg.
     */
    ffmpegArgs: string[];
}

export interface PreviewSession {
    /** Subscribe to byte chunks streaming from ffmpeg. */
    onData(handler: (chunk: Buffer) => void): void;
    /**
     * Tear down: remove the AMCP consumer, close the local TCP listener,
     * drop ffmpeg's connection. Safe to call multiple times.
     */
    close(): Promise<void>;
}

interface InternalSession extends PreviewSession {
    channel: number;
    consumerIndex: number;
    server: net.Server;
    ffmpegSocket: net.Socket | null;
    handlers: ((chunk: Buffer) => void)[];
    closed: boolean;
}

export interface WebRTCSessionOptions {
    channel: number;
    /** SDP offer from the browser, exchanged via the WHEP endpoint. */
    sdpOffer: string;
}

export interface WebRTCSession {
    /** SDP answer to send back to the browser. */
    sdpAnswer: string;
    /** Tear down the AMCP consumer, UDP listener, and peer connection. */
    close(): Promise<void>;
}

interface InternalWebRTCSession extends WebRTCSession {
    channel: number;
    consumerIndex: number;
    server: net.Server;
    getFfmpegSocket: () => net.Socket | null;
    pc: RTCPeerConnection;
    closed: boolean;
}

export class PreviewManager {
    private sessions = new Set<InternalSession>();
    private webrtcSessions = new Set<InternalWebRTCSession>();

    public constructor(private executor: CasparExecutor) {}

    /**
     * WebRTC variant: spin up an in-process werift peer connection that
     * receives raw H.264 (Annex-B) from CasparCG's ffmpeg consumer over
     * loopback TCP, packetizes it as H.264/RTP per RFC 6184, and forwards
     * to the browser via WebRTC. Sub-second latency vs. the MPEG-TS+MSE
     * pipeline's several seconds, no Media Source Extensions involvement,
     * no native peer dependencies (werift is pure JS so the pkg-packaged
     * binary stays single-file).
     *
     * We don't use ffmpeg's `rtp` muxer because the CasparCG consumer
     * always creates an audio Stream alongside video when oformat's
     * audio_codec isn't NONE, and the RTP muxer rejects multi-stream
     * output. The `h264` muxer is video-only (audio_codec = NONE), so the
     * consumer skips audio entirely and we get a clean Annex-B byte stream
     * to packetize ourselves.
     */
    public async openWebRTC(opts: WebRTCSessionOptions): Promise<WebRTCSession> {
        if (!this.executor.connected)
            throw new Error('CasparCG is not connected — start the server first');

        const consumerIndex = nextConsumerIndex++;

        // Listen on a free port on loopback for ffmpeg's Annex-B byte stream.
        const server = net.createServer();
        await new Promise<void>((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', () => {
                server.removeListener('error', reject);
                resolve();
            });
        });
        const port = (server.address() as net.AddressInfo).port;
        const url = `tcp://127.0.0.1:${port}`;

        // Peer connection + sendonly video track. Pre-configuring `codecs`
        // pins the SDP answer's m=video to H.264 PT 96 with the fmtp line
        // that matches what we emit via the packetizer.
        const pc = new RTCPeerConnection({
            codecs: {video: [WEBRTC_VIDEO_CODEC]},
            iceServers: [],
        });
        const track = new MediaStreamTrack({kind: 'video'});
        const transceiver = pc.addTransceiver(track, {direction: 'sendonly'});
        const sender = transceiver.sender;

        const packetizer = new H264Packetizer({
            payloadType: WEBRTC_VIDEO_CODEC.payloadType,
            ssrc: Math.floor(Math.random() * 0xffffffff),
            fps: PREVIEW_FPS,
        });

        // We bypass `track.writeRtp` and push packets through the sender
        // directly. writeRtp dispatches via a non-awaited event emitter, so
        // calling it in a synchronous loop kicks off N concurrent
        // sender.sendRtp promises that race on SRTP state and the UDP
        // socket — fragments end up wire-reordered, which on a single
        // large slice manifests as "top of frame correct, rest is the
        // previous frame's last decoded row". A single drain promise that
        // awaits each send fixes that.
        const queue: import('werift').RtpPacket[] = [];
        let draining = false;
        const drain = async () => {
            if (draining) return;
            draining = true;
            try {
                while (queue.length > 0) {
                    const pkt = queue.shift();
                    if (pkt) await sender.sendRtp(pkt);
                }
            } catch (e) {
                logger.warn(`send failed: ${(e as Error).message}`);
            } finally {
                draining = false;
            }
        };

        let ffmpegSocket: net.Socket | null = null;
        server.on('connection', (socket) => {
            ffmpegSocket = socket;
            socket.on('data', (chunk) => {
                try {
                    for (const pkt of packetizer.push(chunk)) queue.push(pkt);
                    void drain();
                } catch (e) {
                    logger.warn(`packetize failed: ${(e as Error).message}`);
                }
            });
            socket.on('close', () => { ffmpegSocket = null; });
            socket.on('error', (e) => logger.warn(`ffmpeg socket error: ${e.message}`));
        });

        // SDP exchange. werift mirrors the browser API closely.
        await pc.setRemoteDescription({type: 'offer', sdp: opts.sdpOffer});
        await pc.setLocalDescription(await pc.createAnswer());
        const sdpAnswer = pc.localDescription?.sdp;
        if (!sdpAnswer) throw new Error('werift failed to produce an SDP answer');

        const cmd = BasicCommand.construct(
            'ADD',
            `${opts.channel}-${consumerIndex}`,
            'STREAM',
            url,
            ...H264_PREVIEW_ARGS,
        );
        try { await this.executor.execute(cmd); }
        catch (e) {
            server.close();
            await pc.close().catch(() => undefined);
            throw new Error(`AMCP ADD failed: ${(e as Error).message ?? e}`);
        }

        const session: InternalWebRTCSession = {
            channel: opts.channel,
            consumerIndex,
            server,
            getFfmpegSocket: () => ffmpegSocket,
            pc,
            closed: false,
            sdpAnswer,
            close: () => this.closeWebRTCSession(session),
        };

        // The peer connection closing (browser tab closed, ICE failed, etc.)
        // should tear everything down on its own — no DELETE endpoint needed.
        pc.connectionStateChange.subscribe((state) => {
            if (state === 'closed' || state === 'failed' || state === 'disconnected')
                this.closeWebRTCSession(session)
                    .catch((e) => logger.warn(`close failed: ${(e as Error).message}`));
        });

        this.webrtcSessions.add(session);
        logger.debug(`Opened WebRTC preview ch=${opts.channel} idx=${consumerIndex} port=${port}`);

        return session;
    }

    private async closeWebRTCSession(session: InternalWebRTCSession): Promise<void> {
        if (session.closed) return;
        session.closed = true;
        this.webrtcSessions.delete(session);

        try {
            await this.executor.execute(
                BasicCommand.construct('REMOVE', `${session.channel}-${session.consumerIndex}`),
            );
        } catch (e) {
            logger.warn(`AMCP REMOVE failed for ${session.channel}-${session.consumerIndex}: ${(e as Error).message ?? e}`);
        }

        try { await session.pc.close(); } catch { /* noop */ }
        try { session.getFfmpegSocket()?.destroy(); } catch { /* noop */ }
        try { session.server.close(); } catch { /* noop */ }

        logger.debug(`Closed WebRTC preview ch=${session.channel} idx=${session.consumerIndex}`);
    }

    /**
     * Open a per-client ffmpeg stream session against the given channel.
     * The caller drives the transport (HTTP, WebSocket, etc.) by attaching
     * a handler via `session.onData(...)`.
     */
    public async openSession(opts: PreviewSessionOptions): Promise<PreviewSession> {
        if (!this.executor.connected)
            throw new Error('CasparCG is not connected — start the server first');

        const consumerIndex = nextConsumerIndex++;

        // Listen on a free port (OS-picked) bound to loopback only — CasparCG
        // runs on the same machine, no reason to expose this externally.
        const server = net.createServer();
        await new Promise<void>((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', () => {
                server.removeListener('error', reject);
                resolve();
            });
        });
        const port = (server.address() as net.AddressInfo).port;
        const url = `tcp://127.0.0.1:${port}`;

        const session: InternalSession = {
            channel: opts.channel,
            consumerIndex,
            server,
            ffmpegSocket: null,
            handlers: [],
            closed: false,

            onData: (handler) => {
                session.handlers.push(handler);
            },
            close: () => this.closeSession(session),
        };

        server.on('connection', (socket) => {
            session.ffmpegSocket = socket;
            socket.on('data', (chunk) => {
                if (session.closed) return;
                for (const h of session.handlers) 
                    try { h(chunk); } catch (e) { logger.error(e as Error); }
                
            });
            socket.on('close', () => { session.ffmpegSocket = null; });
            socket.on('error', (e) => logger.warn(`ffmpeg socket error: ${e.message}`));
        });

        // The `<ch>-<consumerIndex>` syntax pins the consumer slot so REMOVE
        // later targets exactly this one. BasicCommand.construct handles
        // arg quoting + the trailing \r\n so the AMCP parser actually
        // dispatches and we get a 202 back.
        const cmd = BasicCommand.construct(
            'ADD',
            `${opts.channel}-${consumerIndex}`,
            'STREAM',
            url,
            ...opts.ffmpegArgs,
        );
        try {
            await this.executor.execute(cmd);
        } catch (e) {
            // Clean up the listener if AMCP refused the command.
            server.close();
            throw new Error(`AMCP ADD failed: ${(e as Error).message ?? e}`);
        }

        this.sessions.add(session);
        logger.debug(`Opened preview session ch=${opts.channel} idx=${consumerIndex} port=${port}`);

        return session;
    }

    private async closeSession(session: InternalSession): Promise<void> {
        if (session.closed) return;
        session.closed = true;

        this.sessions.delete(session);

        // Best-effort REMOVE — failure here is non-fatal (CasparCG might
        // already be gone) but we still want to drop our local resources.
        try {
            await this.executor.execute(
                BasicCommand.construct('REMOVE', `${session.channel}-${session.consumerIndex}`),
            );
        } catch (e) {
            logger.warn(`AMCP REMOVE failed for ${session.channel}-${session.consumerIndex}: ${(e as Error).message ?? e}`);
        }

        if (session.ffmpegSocket) session.ffmpegSocket.destroy();
        session.server.close();

        logger.debug(`Closed preview session ch=${session.channel} idx=${session.consumerIndex}`);
    }

    /** Tear down everything — used at manager shutdown. */
    public async disposeAll(): Promise<void> {
        const mpegts = Array.from(this.sessions);
        const webrtc = Array.from(this.webrtcSessions);
        await Promise.all([
            ...mpegts.map((s) => this.closeSession(s)),
            ...webrtc.map((s) => this.closeWebRTCSession(s)),
        ]);
    }
}
