import net from 'net';
import dgram from 'dgram';
import path from 'path';
import {spawn, ChildProcess} from 'child_process';
import {BasicCommand} from '@lappis/cg-manager';
import {
    MediaStreamTrack,
    RTCPeerConnection,
    RTCRtpCodecParameters,
    RtpPacket,
} from 'werift';
import {noTry, noTryAsync} from 'no-try';
import managerConfig from '../../util/config';
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

// ffmpeg args for the CasparCG-side encoder. We can't use ffmpeg's `rtp`
// muxer from the consumer because CasparCG always creates an audio Stream
// when `oformat->audio_codec != NONE` (RTP defaults to PCM_MULAW), and the
// RTP muxer refuses multi-stream output. The `h264` muxer is video-only
// (audio_codec = NONE), so the consumer skips audio entirely and we get
// a clean Annex-B byte stream. A sidecar ffmpeg child then `-c copy`s it
// into RTP — using ffmpeg's RFC 6184 packetizer instead of our own.
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

const RTP_PAYLOAD_TYPE = 96;

/** Locate the ffmpeg binary shipped next to caspar. Falls back to PATH
 *  lookup if `caspar-path` isn't configured (dev mode running from a
 *  directory that has ffmpeg on PATH). */
function ffmpegBinary(): string {
    const folder = managerConfig['caspar-path'];
    if (!folder) return 'ffmpeg';
    const ext = process.platform === 'win32' ? '.exe' : '';
    return path.join(folder, `ffmpeg${ext}`);
}

// Consumer slot index for preview sessions starts well above the typical
// statically-configured consumers (which sit at 1..N from the XML). Each
// new session bumps the counter; CasparCG only cares about uniqueness
// within a channel but we make it globally unique for easier tracking.
let nextConsumerIndex = 100;

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
    tcpServer: net.Server;
    udpSocket: dgram.Socket;
    ffmpeg: ChildProcess;
    getCasparSocket: () => net.Socket | null;
    pc: RTCPeerConnection;
    closed: boolean;
}

export class PreviewManager {
    private webrtcSessions = new Set<InternalWebRTCSession>();

    public constructor(private executor: CasparExecutor) {}

    /**
     * Spin up an in-process werift peer connection that receives raw H.264
     * (Annex-B) from CasparCG's ffmpeg consumer over loopback TCP, packetizes
     * it as H.264/RTP per RFC 6184 via a sidecar ffmpeg, and forwards to the
     * browser via WebRTC. Sub-second latency, no Media Source Extensions,
     * no native peer dependencies (werift is pure JS so the pkg-packaged
     * binary stays single-file).
     *
     * Pipeline:
     *   CasparCG ffmpeg consumer
     *     │ h264 Annex-B over TCP (no audio — `h264` muxer is video-only)
     *     ▼
     *   manager TCP listener
     *     │ pipe(socket → child stdin)
     *     ▼
     *   sidecar ffmpeg child  (`-f h264 -i - -c copy -an -f rtp ...`)
     *     │ packetized H.264/RTP over UDP
     *     ▼
     *   manager UDP listener  →  RtpPacket.deSerialize  →  track.writeRtp
     *
     * The sidecar exists because CasparCG's consumer creates a second
     * (audio) stream whenever `oformat->audio_codec != NONE`, and ffmpeg's
     * RTP muxer rejects multi-stream output (`Only one stream supported`).
     * Routing the h264 byte stream through a child ffmpeg lets us use
     * ffmpeg's RFC 6184 packetizer (the same one mediasoup et al. consume)
     * instead of writing our own.
     */
    public async openWebRTC(opts: WebRTCSessionOptions): Promise<WebRTCSession> {
        if (!this.executor.connected)
            throw new Error('CasparCG is not connected — start the server first');

        const consumerIndex = nextConsumerIndex++;

        // 1. UDP socket for the sidecar's RTP output.
        const udpSocket = dgram.createSocket('udp4');
        await new Promise<void>((resolve, reject) => {
            udpSocket.once('error', reject);
            udpSocket.bind(0, '127.0.0.1', () => {
                udpSocket.removeListener('error', reject);
                resolve();
            });
        });
        const udpPort = udpSocket.address().port;

        // 2. TCP listener for CasparCG → sidecar's stdin.
        const tcpServer = net.createServer();
        await new Promise<void>((resolve, reject) => {
            tcpServer.once('error', reject);
            tcpServer.listen(0, '127.0.0.1', () => {
                tcpServer.removeListener('error', reject);
                resolve();
            });
        });
        const tcpPort = (tcpServer.address() as net.AddressInfo).port;

        // 3. Peer connection + sendonly video track. The codec config pins
        //    the SDP answer's m=video to the same params ffmpeg's RTP muxer
        //    actually emits.
        const pc = new RTCPeerConnection({
            codecs: {video: [WEBRTC_VIDEO_CODEC]},
            iceServers: [],
        });
        const track = new MediaStreamTrack({kind: 'video'});
        pc.addTransceiver(track, {direction: 'sendonly'});

        // 4. Sidecar ffmpeg. `-c copy` so we don't re-encode; ffmpeg just
        //    packetizes whatever NAL units arrive on stdin into RTP.
        //    `-fflags +nobuffer -flags low_delay` for minimum demux latency.
        //    `-an` to suppress any audio path entirely.
        const ffmpeg = spawn(ffmpegBinary(), [
            '-fflags',
            '+nobuffer',
            '-flags',
            'low_delay',
            '-f',
            'h264',
            '-i',
            'pipe:0',
            '-an',
            '-c:v',
            'copy',
            '-payload_type',
            String(RTP_PAYLOAD_TYPE),
            '-f',
            'rtp',
            `rtp://127.0.0.1:${udpPort}`,
        ], {stdio: ['pipe', 'ignore', 'pipe']});
        ffmpeg.on('error', (e) => logger.warn(`sidecar ffmpeg spawn failed: ${e.message}`));
        ffmpeg.stderr?.on('data', (d) => {
            // Surface ffmpeg's complaints (rare but useful when things break);
            // happy-path output is throttled to debug level.
            const line = d.toString();
            if (/error|fatal|cannot/i.test(line))
                logger.warn(`sidecar ffmpeg: ${line.trim()}`);
        });

        // 5. UDP → werift. Plain deSerialize + writeRtp (the canonical
        //    werift sendonly pattern, see examples/mediachannel/sendonly).
        //    Because ffmpeg sends one RTP packet per UDP datagram, there's
        //    no fragmentation/concurrency hazard like with our hand-rolled
        //    packetizer.
        udpSocket.on('message', (buf) => {
            try { track.writeRtp(RtpPacket.deSerialize(buf)); }
            catch (e) { logger.warn(`writeRtp failed: ${(e as Error).message}`); }
        });

        // 6. CasparCG TCP → sidecar stdin pipe. The first connection wins;
        //    subsequent connections (shouldn't happen) get closed.
        let casparSocket: net.Socket | null = null;
        tcpServer.on('connection', (socket) => {
            if (casparSocket) { socket.destroy(); return; }
            casparSocket = socket;
            if (ffmpeg.stdin) socket.pipe(ffmpeg.stdin);
            socket.on('close', () => { casparSocket = null; });
            socket.on('error', (e) => logger.warn(`caspar socket error: ${e.message}`));
        });

        // 7. SDP exchange.
        await pc.setRemoteDescription({type: 'offer', sdp: opts.sdpOffer});
        await pc.setLocalDescription(await pc.createAnswer());
        const sdpAnswer = pc.localDescription?.sdp;
        if (!sdpAnswer) throw new Error('werift failed to produce an SDP answer');

        // 8. Hand off to CasparCG — it'll connect to our TCP listener.
        const cmd = BasicCommand.construct(
            'ADD',
            `${opts.channel}-${consumerIndex}`,
            'STREAM',
            `tcp://127.0.0.1:${tcpPort}`,
            ...H264_PREVIEW_ARGS,
        );
        try { await this.executor.execute(cmd); }
        catch (e) {
            tcpServer.close();
            udpSocket.close();
            ffmpeg.kill('SIGTERM');
            await pc.close().catch(() => undefined);
            throw new Error(`AMCP ADD failed: ${(e as Error).message ?? e}`);
        }

        const session: InternalWebRTCSession = {
            channel: opts.channel,
            consumerIndex,
            tcpServer,
            udpSocket,
            ffmpeg,
            getCasparSocket: () => casparSocket,
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
        logger.debug(
            `Opened WebRTC preview ch=${opts.channel} idx=${consumerIndex} ` +
            `tcp=${tcpPort} udp=${udpPort} ffmpeg=${ffmpeg.pid}`,
        );

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

        await noTryAsync(() => session.pc.close());
        noTry(() => session.getCasparSocket()?.destroy());
        noTry(() => session.tcpServer.close());
        noTry(() => session.udpSocket.close());
        noTry(() => session.ffmpeg.kill('SIGTERM'));

        logger.debug(`Closed WebRTC preview ch=${session.channel} idx=${session.consumerIndex}`);
    }

    /** Tear down everything — used at manager shutdown. */
    public async disposeAll(): Promise<void> {
        const webrtc = Array.from(this.webrtcSessions);
        await Promise.all(webrtc.map((s) => this.closeWebRTCSession(s)));
    }
}
