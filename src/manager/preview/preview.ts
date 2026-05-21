import net from 'net';
import dgram from 'dgram';
import {BasicCommand} from '@lappis/cg-manager';
import {
    MediaStreamTrack,
    RTCPeerConnection,
    RTCRtpCodecParameters,
} from 'werift';
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

// ffmpeg args for the RTP egress side. Same low-latency H.264 config as the
// MPEG-TS path but written for RTP: -format rtp + payload type 96 so the
// wire packets match WEBRTC_VIDEO_CODEC's advertised PT. CasparCG's consumer
// parses option names long-form (ffmpeg_consumer.cpp:502 + :517), so every
// option is spelled in full.
const RTP_PREVIEW_ARGS = [
    '-format',
    'rtp',
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
    '-pix_fmt:v',
    'yuv420p',
    '-bf:v',
    '0',
    '-g:v',
    '15',
    '-b:v',
    '800k',
    '-filter:v',
    'fps=15,scale=640:-2',
    '-payload_type',
    '96',
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
    socket: dgram.Socket;
    pc: RTCPeerConnection;
    closed: boolean;
}

export class PreviewManager {
    private sessions = new Set<InternalSession>();
    private webrtcSessions = new Set<InternalWebRTCSession>();

    public constructor(private executor: CasparExecutor) {}

    /**
     * WebRTC variant: instead of forwarding raw MPEG-TS over WebSocket,
     * spin up an in-process werift peer connection that receives H.264/RTP
     * from CasparCG's ffmpeg consumer on loopback UDP and republishes it
     * over the WebRTC transport directly to the browser. Sub-second latency
     * vs. the MPEG-TS+MSE pipeline's several seconds, no Media Source
     * Extensions involvement, no native peer dependencies (werift is pure
     * JS so the pkg-packaged binary stays single-file).
     */
    public async openWebRTC(opts: WebRTCSessionOptions): Promise<WebRTCSession> {
        if (!this.executor.connected)
            throw new Error('CasparCG is not connected — start the server first');

        const consumerIndex = nextConsumerIndex++;

        // UDP receiver for the RTP stream ffmpeg sends. Bind to a free port
        // on loopback only — ffmpeg also wants to send RTCP to port+1; we
        // don't bind that port, so those packets are dropped harmlessly.
        const socket = dgram.createSocket('udp4');
        await new Promise<void>((resolve, reject) => {
            socket.once('error', reject);
            socket.bind(0, '127.0.0.1', () => {
                socket.removeListener('error', reject);
                resolve();
            });
        });
        const port = socket.address().port;
        const url = `rtp://127.0.0.1:${port}`;

        // Peer connection + sendonly video track. Pre-configuring `codecs`
        // pins the SDP answer's m=video to H.264 PT 96 with the fmtp line
        // that matches what ffmpeg emits.
        const pc = new RTCPeerConnection({
            codecs: {video: [WEBRTC_VIDEO_CODEC]},
            iceServers: [],
        });
        const track = new MediaStreamTrack({kind: 'video'});
        pc.addTransceiver(track, {direction: 'sendonly'});

        socket.on('message', (buf) => {
            // RTCP packets share port+0/+1 typically; filter out the RTCP
            // payload-type range (72-95 / 200-209 reserved) so we only feed
            // RTP data into the track. ffmpeg already aims RTCP at port+1
            // but defending against misconfig is cheap.
            const pt = buf[1] & 0x7f;
            if (pt >= 72 && pt <= 95) return;
            try { track.writeRtp(buf); }
            catch (e) { logger.warn(`writeRtp failed: ${(e as Error).message}`); }
        });

        // SDP exchange. werift mirrors the browser API closely.
        await pc.setRemoteDescription({type: 'offer', sdp: opts.sdpOffer});
        await pc.setLocalDescription(await pc.createAnswer());
        const sdpAnswer = pc.localDescription?.sdp;
        if (!sdpAnswer) throw new Error('werift failed to produce an SDP answer');

        // Hand off to CasparCG. The consumer slot is pinned the same way
        // the MPEG-TS path does it so REMOVE targets exactly this stream.
        const cmd = BasicCommand.construct(
            'ADD',
            `${opts.channel}-${consumerIndex}`,
            'STREAM',
            url,
            ...RTP_PREVIEW_ARGS,
        );
        try { await this.executor.execute(cmd); }
        catch (e) {
            socket.close();
            await pc.close().catch(() => undefined);
            throw new Error(`AMCP ADD failed: ${(e as Error).message ?? e}`);
        }

        const session: InternalWebRTCSession = {
            channel: opts.channel,
            consumerIndex,
            socket,
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
        try { session.socket.close(); } catch { /* noop */ }

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
