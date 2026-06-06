import net from 'net';
import dgram from 'dgram';
import path from 'path';
import {spawn, type ChildProcess} from 'child_process';
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
import {type CasparExecutor} from '../caspar/executor';

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
    // VBV cap so keyframes don't get fired as one big burst — without these,
    // a 1s GOP at 800k average can emit a ~200kB packet train when the
    // I-frame lands, and a single packet drop over WiFi takes out the
    // whole keyframe (decoder stalls until next one, ~1s pause). The tight
    // bufsize (well under 1s × maxrate) flattens the curve at a small
    // quality cost on motion peaks.
    '-maxrate:v',
    '1000k',
    '-bufsize:v',
    '500k',
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
    udpSocket: dgram.Socket;
    ffmpeg: ChildProcess;
    pc: RTCPeerConnection;
    closed: boolean;
}

/** Bind, read the OS-assigned port, immediately close — we only need a
 *  free port number to pass to ffmpeg, not the socket itself. There's a
 *  small race window where another process could grab the port between
 *  close and ffmpeg's bind, but on loopback that's essentially never an
 *  issue (and a failed bind surfaces as an ffmpeg error we'd see anyway). */
async function pickFreeTcpPort(): Promise<number> {
    const probe = net.createServer();
    await new Promise<void>((resolve, reject) => {
        probe.once('error', reject);
        probe.listen(0, '127.0.0.1', () => {
            probe.removeListener('error', reject);
            resolve();
        });
    });
    const port = (probe.address() as net.AddressInfo).port;
    await new Promise<void>((resolve) => probe.close(() => resolve()));
    return port;
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
     *   sidecar ffmpeg child  (`-i tcp://...?listen=1 -c copy -an -f rtp ...`)
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

        const udpSocket = dgram.createSocket('udp4');
        await new Promise<void>((resolve, reject) => {
            udpSocket.once('error', reject);
            udpSocket.bind(0, '127.0.0.1', () => {
                udpSocket.removeListener('error', reject);
                resolve();
            });
        });
        const udpPort = udpSocket.address().port;

        const tcpPort = await pickFreeTcpPort();

        const pc = new RTCPeerConnection({
            codecs: {video: [WEBRTC_VIDEO_CODEC]},
            iceServers: [],
        });
        const track = new MediaStreamTrack({kind: 'video'});
        pc.addTransceiver(track, {direction: 'sendonly'});

        const ffmpeg = spawn(ffmpegBinary(), [
            '-fflags',
            '+nobuffer',
            '-flags',
            'low_delay',
            '-f',
            'h264',
            '-i',
            `tcp://127.0.0.1:${tcpPort}?listen=1&listen_timeout=0`,
            '-an',
            '-c:v',
            'copy',
            '-payload_type',
            String(RTP_PAYLOAD_TYPE),
            '-f',
            'rtp',
            `rtp://127.0.0.1:${udpPort}`,
        ], {stdio: ['ignore', 'ignore', 'pipe']});
        ffmpeg.on('error', (e) => logger.warn(`sidecar ffmpeg spawn failed: ${e.message}`));
        ffmpeg.stderr?.on('data', (d) => {
            const line = d.toString();
            if (/error|fatal|cannot/i.test(line))
                logger.warn(`sidecar ffmpeg: ${line.trim()}`);
        });

        // Plain deSerialize + writeRtp (the canonical werift sendonly pattern).
        // ffmpeg sends one RTP packet per UDP datagram, so there's no
        // fragmentation/concurrency hazard like with hand-rolled packetizing.
        udpSocket.on('message', (buf) => {
            const [err] = noTry(() => track.writeRtp(RtpPacket.deSerialize(buf)));
            if (err) logger.warn(`writeRtp failed: ${err.message}`);
        });

        // SDP exchange and AMCP ADD have no data dependency on each other —
        // werift only needs `pc`, AMCP only needs `tcpPort` and a spawned
        // sidecar. Firing them in parallel shaves the AMCP round-trip off
        // perceived activation time.
        const sdpPromise = noTryAsync(async () => {
            await pc.setRemoteDescription({type: 'offer', sdp: opts.sdpOffer});
            await pc.setLocalDescription(await pc.createAnswer());
            const sdp = pc.localDescription?.sdp;
            if (!sdp) throw new Error('werift failed to produce an SDP answer');
            return sdp;
        });
        const addPromise = noTryAsync(() => this.executor.execute(
            BasicCommand.construct(
                'ADD',
                `${opts.channel}-${consumerIndex}`,
                'STREAM',
                `tcp://127.0.0.1:${tcpPort}`,
                ...H264_PREVIEW_ARGS,
            ),
        ));

        const [sdpErr, sdpAnswer] = await sdpPromise;
        const [addErr] = await addPromise;

        if (sdpErr || addErr) {
            udpSocket.close();
            ffmpeg.kill('SIGTERM');
            await noTryAsync(() => pc.close());
            // If ADD landed but SDP failed, undo the consumer so we don't
            // leave a dangling encoder feeding nothing.
            if (!addErr) await noTryAsync(() => this.executor.execute(
                BasicCommand.construct('REMOVE', `${opts.channel}-${consumerIndex}`),
            ));
            if (sdpErr) throw sdpErr;
            throw new Error(`AMCP ADD failed: ${addErr!.message ?? addErr}`);
        }

        const session: InternalWebRTCSession = {
            channel: opts.channel,
            consumerIndex,
            udpSocket,
            ffmpeg,
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

        const [removeErr] = await noTryAsync(() => this.executor.execute(
            BasicCommand.construct('REMOVE', `${session.channel}-${session.consumerIndex}`),
        ));
        if (removeErr)
            logger.warn(`AMCP REMOVE failed for ${session.channel}-${session.consumerIndex}: ${removeErr.message ?? removeErr}`);

        await noTryAsync(() => session.pc.close());
        noTry(() => session.udpSocket.close());
        noTry(() => session.ffmpeg.kill('SIGTERM'));

        logger.debug(`Closed WebRTC preview ch=${session.channel} idx=${session.consumerIndex}`);
    }

    public async disposeAll(): Promise<void> {
        const webrtc = Array.from(this.webrtcSessions);
        await Promise.all(webrtc.map((s) => this.closeWebRTCSession(s)));
    }
}
