import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { spawn, type ChildProcess } from 'child_process';
import { Logger } from '../../../util/log';
import { ffmpegBinary } from '../../../util/ffmpeg';
import { H264_PAYLOAD_TYPE, OPUS_PAYLOAD_TYPE } from '../shared/codecs';
import { type IngestSink } from './sinks';

const logger = Logger.scope('Ingest');

export interface PipelinePorts {
    video: number;
    audio?: number;
    sink: number;
}

const sdpDir = () => path.join(os.tmpdir(), 'cg-manager', 'ingest');

// Pinning payload types in the peer connection is what lets this be a static
// template: the browser can only answer with the codecs we offered, so the
// numbers here always match what arrives on the wire.
function sdpFor(ports: PipelinePorts): string {
    const lines = [
        'v=0',
        'o=- 0 0 IN IP4 127.0.0.1',
        's=cg-manager-ingest',
        'c=IN IP4 127.0.0.1',
        't=0 0',
        `m=video ${ports.video} RTP/AVP ${H264_PAYLOAD_TYPE}`,
        // Stated explicitly because libavformat otherwise binds RTP+1 for
        // RTCP, which would collide with the next media line's RTP port.
        `a=rtcp:${ports.video + 1}`,
        `a=rtpmap:${H264_PAYLOAD_TYPE} H264/90000`,
        `a=fmtp:${H264_PAYLOAD_TYPE} packetization-mode=1`,
    ];
    if (ports.audio)
        lines.push(
            `m=audio ${ports.audio} RTP/AVP ${OPUS_PAYLOAD_TYPE}`,
            `a=rtcp:${ports.audio + 1}`,
            `a=rtpmap:${OPUS_PAYLOAD_TYPE} opus/48000/2`,
        );

    return `${lines.join('\n')}\n`;
}

export interface Pipeline {
    ffmpeg: ChildProcess;
    close(): Promise<void>;
}

/** Nothing sweeps these on a crash or hard kill, so clear them on startup —
 *  same treatment the recorder gives its temp dir. */
export async function clearStaleSdp(): Promise<void> {
    await fs.rm(sdpDir(), { recursive: true, force: true });
}

export async function startPipeline(
    id: string,
    ports: PipelinePorts,
    sink: IngestSink,
    onExit: () => void,
): Promise<Pipeline> {
    await fs.mkdir(sdpDir(), { recursive: true });
    const sdpPath = path.join(sdpDir(), `${id}.sdp`);
    await fs.writeFile(sdpPath, sdpFor(ports));

    const ffmpeg = spawn(
        ffmpegBinary(),
        [
            '-protocol_whitelist',
            'file,udp,rtp',
            '-fflags',
            '+nobuffer',
            '-flags',
            'low_delay',
            // Deliberately generous, and NOT the latency knob it looks like:
            // `-c:v copy` can't open the output until it has read SPS/PPS for
            // the frame size, and the first RTP only arrives once the browser
            // finishes ICE/DTLS — well after this process starts. These are
            // ceilings, not waits: probing ends at the first keyframe. Tighten
            // them and ffmpeg exits with "Could not find codec parameters"
            // before the sender ever connects.
            '-probesize',
            '10000000',
            '-analyzeduration',
            '10000000',
            '-i',
            sdpPath,
            ...sink.args(ports.sink),
        ],
        { stdio: ['ignore', 'ignore', 'pipe'] },
    );

    ffmpeg.stderr?.on('data', d => {
        const line = d.toString();
        if (/error|fatal|cannot/i.test(line))
            logger.warn(`ingest ffmpeg: ${line.trim()}`);
    });

    let closing = false;

    // A dead pipeline would otherwise leave a session reporting itself live
    // while its RTP goes nowhere, holding ports until the process exits.
    const reportExit = (reason: string) => {
        if (closing) return;
        logger.warn(`ingest ffmpeg ${reason} for ${id}`);
        onExit();
    };
    ffmpeg.on('error', e => reportExit(`failed to spawn (${e.message})`));
    ffmpeg.on('exit', code => reportExit(`exited (${code})`));

    return {
        ffmpeg,
        close: async () => {
            closing = true;
            await stopProcess(ffmpeg);
            await fs.rm(sdpPath, { force: true });
        },
    };
}

const KILL_GRACE_MS = 2000;

/** Awaited so the next session can't claim a port this ffmpeg still holds. */
function stopProcess(ffmpeg: ChildProcess): Promise<void> {
    if (ffmpeg.exitCode !== null || ffmpeg.signalCode !== null)
        return Promise.resolve();

    return new Promise(resolve => {
        const done = () => {
            clearTimeout(timer);
            resolve();
        };
        const timer = setTimeout(() => {
            ffmpeg.kill('SIGKILL');
            resolve();
        }, KILL_GRACE_MS);

        ffmpeg.once('exit', done);
        ffmpeg.kill('SIGTERM');
    });
}
