import net from 'net';
import dgram from 'dgram';
import fs from 'fs';
import path from 'path';
import { spawn, type ChildProcess } from 'child_process';
import { type Consumer } from '@lappis/cg-manager';
import {
    MediaStreamTrack,
    RTCDtlsTransport,
    RTCPeerConnection,
    RTCRtpCodecParameters,
    RtpPacket,
    type DtlsKeys,
} from 'werift';
import { noTry, noTryAsync } from 'no-try';
import managerConfig from '../../util/config';
import { Logger } from '../../util/log';
import { type CasparExecutor } from '../caspar/executor';

const logger = Logger.scope('Preview');

// Constrained Baseline 3.1 is accepted by every browser; payloadType 96 matches ffmpeg's `-payload_type`.
const WEBRTC_VIDEO_CODEC = new RTCRtpCodecParameters({
    mimeType: 'video/H264',
    clockRate: 90000,
    payloadType: 96,
    parameters:
        'level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f',
});

// CasparCG adds an audio stream unless the muxer is video-only, and the rtp muxer rejects
// multi-stream output. The `h264` muxer is video-only, so a sidecar ffmpeg `-c copy`s it into RTP.
// `format=yuv420p` must be in the filter chain, not `-pix_fmt:v`: for BGRA the scaler picks
// yuv444p, and libx264 then refuses Baseline (4:2:0 only), the only profile browsers accept.
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
    // VBV cap: without it a keyframe bursts ~200kB and one WiFi drop stalls the decoder until the next.
    '-maxrate:v',
    '1000k',
    '-bufsize:v',
    '500k',
    '-filter:v',
    `fps=${PREVIEW_FPS},scale=640:-2,format=yuv420p`,
];

const RTP_PAYLOAD_TYPE = 96;

/** Windows ships ffmpeg.exe next to caspar; the Linux bundle has only shared libs, so fall back to PATH. */
function ffmpegBinary(): string {
    const folder = managerConfig['caspar-path'];
    if (!folder) return 'ffmpeg';
    const ext = process.platform === 'win32' ? '.exe' : '';
    const bundled = path.join(folder, `ffmpeg${ext}`);
    return fs.existsSync(bundled) ? bundled : 'ffmpeg';
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
    consumer: Consumer;
    udpSocket: dgram.Socket;
    tcpServer: net.Server;
    ffmpeg: ChildProcess;
    pc: RTCPeerConnection;
    closed: boolean;
}

/** Bound before the AMCP ADD so CasparCG can never connect to a not-yet-bound port (Linux 'Connection refused' race). */
async function listenTcp(): Promise<{ server: net.Server; port: number }> {
    const server = net.createServer();
    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            server.removeListener('error', reject);
            resolve();
        });
    });
    return { server, port: (server.address() as net.AddressInfo).port };
}

export class PreviewManager {
    private webrtcSessions = new Set<InternalWebRTCSession>();
    // Pre-generated once to avoid per-session key generation cost.
    private dtlsKeysPromise: Promise<DtlsKeys> =
        RTCDtlsTransport.SetupCertificate().then(cert => ({
            certPem: cert.certPem,
            keyPem: cert.privateKey,
            signatureHash: cert.signatureHash,
        }));

    public constructor(private executor: CasparExecutor) {
        // Kick off key generation immediately so it's done before the first session.
        this.dtlsKeysPromise.catch(() => {
            /* falls back to werift's per-session cert if this fails */
        });
    }

    /** werift peer fed CasparCG's h264 over loopback TCP, packetized to RTP by a sidecar ffmpeg. */
    public async openWebRTC(
        opts: WebRTCSessionOptions,
    ): Promise<WebRTCSession> {
        if (!this.executor.connected)
            throw new Error(
                'CasparCG is not connected — start the server first',
            );

        const channel = this.executor.getChannel(opts.channel);

        const [, dtlsKeys] = await noTryAsync(() => this.dtlsKeysPromise);

        const udpSocket = dgram.createSocket('udp4');
        await new Promise<void>((resolve, reject) => {
            udpSocket.once('error', reject);
            udpSocket.bind(0, '127.0.0.1', () => {
                udpSocket.removeListener('error', reject);
                resolve();
            });
        });
        const udpPort = udpSocket.address().port;

        const { server: tcpServer, port: tcpPort } = await listenTcp();

        const stunServer = managerConfig['preview-stun'];
        const pc = new RTCPeerConnection({
            codecs: { video: [WEBRTC_VIDEO_CODEC] },
            iceServers: stunServer ? [{ urls: stunServer }] : [],
            ...(dtlsKeys ? { dtls: { keys: dtlsKeys } } : {}),
        });
        const track = new MediaStreamTrack({ kind: 'video' });
        pc.addTransceiver(track, { direction: 'sendonly' });

        // werift defaults to Google STUN and blocks gathering up to 5s per unreachable
        // interface; host candidates suffice for LAN use.
        if (!stunServer) {
            for (const dt of pc.dtlsTransports) {
                const conn = dt?.iceTransport?.connection;
                if (conn) conn.stunServer = undefined;
            }
        }

        const ffmpeg = spawn(
            ffmpegBinary(),
            [
                '-fflags',
                '+nobuffer',
                '-flags',
                'low_delay',
                // Skip the 5s default stream probing; it dominated preview activation time.
                '-probesize',
                '32',
                '-analyzeduration',
                '0',
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
            ],
            { stdio: ['pipe', 'ignore', 'pipe'] },
        );
        ffmpeg.on('error', e =>
            logger.warn(`sidecar ffmpeg spawn failed: ${e.message}`),
        );
        ffmpeg.stderr?.on('data', d => {
            const line = d.toString();
            if (/error|fatal|cannot/i.test(line))
                logger.warn(`sidecar ffmpeg: ${line.trim()}`);
        });

        // Pipe the only connection into ffmpeg; EPIPE is swallowed since teardown handles it.
        tcpServer.maxConnections = 1;
        tcpServer.on('connection', socket => {
            socket.on('error', () => {
                /* caspar reset / ffmpeg gone — teardown handles cleanup */
            });
            if (ffmpeg.stdin) socket.pipe(ffmpeg.stdin);
            // close() leaves this socket open; tie it to ffmpeg so a failed REMOVE cannot leak it.
            ffmpeg.once('close', () => socket.destroy());
        });
        tcpServer.on('error', e =>
            logger.warn(`preview tcp server error: ${e.message}`),
        );
        ffmpeg.stdin?.on('error', () => {
            /* socket closed before ffmpeg drained — expected on teardown */
        });

        udpSocket.on('message', buf => {
            const [err] = noTry(() =>
                track.writeRtp(RtpPacket.deSerialize(buf)),
            );
            if (err) logger.warn(`writeRtp failed: ${err.message}`);
        });

        // SDP exchange and AMCP ADD are independent; run them in parallel.
        const sdpPromise = noTryAsync(async () => {
            await pc.setRemoteDescription({
                type: 'offer',
                sdp: opts.sdpOffer,
            });
            await pc.setLocalDescription(await pc.createAnswer());
            const sdp = pc.localDescription?.sdp;
            if (!sdp) throw new Error('werift failed to produce an SDP answer');
            return sdp;
        });
        const addPromise = noTryAsync(() =>
            channel.addConsumer(
                'STREAM',
                `tcp://127.0.0.1:${tcpPort}`,
                ...H264_PREVIEW_ARGS,
            ),
        );

        const [sdpErr, sdpAnswer] = await sdpPromise;
        const [addErr, consumer] = await addPromise;

        if (sdpErr || addErr) {
            udpSocket.close();
            noTry(() => tcpServer.close());
            ffmpeg.kill('SIGTERM');
            await noTryAsync(() => pc.close());
            // Undo the consumer if ADD landed but SDP failed.
            if (consumer) await noTryAsync(() => consumer.remove());
            if (sdpErr) throw sdpErr;
            throw new Error(`AMCP ADD failed: ${addErr!.message ?? addErr}`);
        }

        const session: InternalWebRTCSession = {
            channel: opts.channel,
            consumer,
            udpSocket,
            tcpServer,
            ffmpeg,
            pc,
            closed: false,
            sdpAnswer,
            close: () => this.closeWebRTCSession(session),
        };

        // Peer connection close tears everything down; no DELETE endpoint.
        pc.connectionStateChange.subscribe(state => {
            if (
                state === 'closed' ||
                state === 'failed' ||
                state === 'disconnected'
            )
                this.closeWebRTCSession(session).catch(e =>
                    logger.warn(`close failed: ${(e as Error).message}`),
                );
        });

        this.webrtcSessions.add(session);
        logger.debug(
            `Opened WebRTC preview ch=${opts.channel} idx=${consumer.index} ` +
                `tcp=${tcpPort} udp=${udpPort} ffmpeg=${ffmpeg.pid}`,
        );

        return session;
    }

    private async closeWebRTCSession(
        session: InternalWebRTCSession,
    ): Promise<void> {
        if (session.closed) return;
        session.closed = true;
        this.webrtcSessions.delete(session);

        const [removeErr] = await noTryAsync(() => session.consumer.remove());
        if (removeErr)
            logger.warn(
                `AMCP REMOVE failed for ${session.channel}-${session.consumer.index}: ${removeErr.message ?? removeErr}`,
            );

        await noTryAsync(() => session.pc.close());
        noTry(() => session.udpSocket.close());
        noTry(() => session.tcpServer.close());
        noTry(() => session.ffmpeg.kill('SIGTERM'));

        logger.debug(
            `Closed WebRTC preview ch=${session.channel} idx=${session.consumer.index}`,
        );
    }

    public async disposeAll(): Promise<void> {
        const webrtc = Array.from(this.webrtcSessions);
        await Promise.all(webrtc.map(s => this.closeWebRTCSession(s)));
    }
}
