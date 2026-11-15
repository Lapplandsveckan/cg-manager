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
    close(): Promise<void>;
}

export interface PipelineHooks {
    /** ffmpeg is reading again, and cannot open its output until the sender
     *  sends SPS/PPS and a keyframe. */
    onRestart(): void;
    onGiveUp(): void;
    /** Media already carried by the sink. ffmpeg's timeline starts at its
     *  first RTP packet, not at spawn, so the wait for ICE/DTLS is not part
     *  of it and a respawn must not offset by it. */
    elapsedMs(): number;
}

/** A demuxer that times out on a quiet sender, or any other mid-stream error,
 *  kills ffmpeg. The peer connection behind it is still perfectly good, so the
 *  disposable half is respawned rather than the session being lost. */
const RESTART_LIMIT = 5;
const RESTART_WINDOW_MS = 30_000;
/** Long enough for the dying process to release the RTP ports it bound. */
const RESTART_DELAY_MS = 250;
/** A keyframe asked for before the new ffmpeg has bound its sockets arrives
 *  nowhere, and recovery then waits for the next periodic request. */
const KEYFRAME_DELAY_MS = 250;

/** Nothing sweeps these on a crash or hard kill, so clear them on startup —
 *  same treatment the recorder gives its temp dir. */
export async function clearStaleSdp(): Promise<void> {
    await fs.rm(sdpDir(), { recursive: true, force: true });
}

function inputArgs(sdpPath: string): string[] {
    return [
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
    ];
}

/** A respawned ffmpeg stamps its first packet at zero again, so without this
 *  the sink's timeline jumps backwards and whoever is playing it has to resync. */
function continuityArgs(elapsedMs: number): string[] {
    if (elapsedMs <= 0) return [];

    return ['-output_ts_offset', `${(elapsedMs / 1000).toFixed(3)}`];
}

function spawnFfmpeg(
    sdpPath: string,
    sink: IngestSink,
    sinkPort: number,
    elapsedMs: number,
): ChildProcess {
    const ffmpeg = spawn(
        ffmpegBinary(),
        [
            ...inputArgs(sdpPath),
            ...continuityArgs(elapsedMs),
            ...sink.args(sinkPort),
        ],
        { stdio: ['ignore', 'ignore', 'pipe'] },
    );

    ffmpeg.stderr?.on('data', d => {
        const line = d.toString();
        if (/error|fatal|cannot/i.test(line))
            logger.warn(`ingest ffmpeg: ${line.trim()}`);
    });

    return ffmpeg;
}

export async function startPipeline(
    id: string,
    ports: PipelinePorts,
    sink: IngestSink,
    hooks: PipelineHooks,
): Promise<Pipeline> {
    await fs.mkdir(sdpDir(), { recursive: true });
    const sdpPath = path.join(sdpDir(), `${id}.sdp`);
    await fs.writeFile(sdpPath, sdpFor(ports));

    let restarts: number[] = [];
    let closing = false;
    const timers = new Set<NodeJS.Timeout>();

    const later = (run: () => void, delay: number) => {
        const timer = setTimeout(() => {
            timers.delete(timer);
            run();
        }, delay);
        timers.add(timer);
    };

    const keepsDying = () => {
        const now = Date.now();
        restarts = [...restarts, now].filter(
            at => now - at < RESTART_WINDOW_MS,
        );

        return restarts.length > RESTART_LIMIT;
    };

    // Node may emit both 'exit' and 'error' for one child, and a restart
    // scheduled twice would orphan an ffmpeg still holding this session's ports.
    const watch = (child: ChildProcess, die: (reason: string) => void) => {
        const once = (reason: string) => {
            child.removeAllListeners('exit');
            child.removeAllListeners('error');
            die(reason);
        };
        child.on('error', e => once(`failed to spawn (${e.message})`));
        child.on('exit', code => once(`exited (${code})`));
    };

    let ffmpeg = spawnFfmpeg(sdpPath, sink, ports.sink, 0);

    const restart = () => {
        if (closing) return;

        ffmpeg = spawnFfmpeg(sdpPath, sink, ports.sink, hooks.elapsedMs());
        watch(ffmpeg, onDeath);
        later(() => hooks.onRestart(), KEYFRAME_DELAY_MS);
    };

    // A dead pipeline would otherwise leave a session reporting itself live
    // while its RTP goes nowhere, holding ports until the process exits.
    function onDeath(reason: string) {
        if (closing) return;
        logger.warn(`ingest ffmpeg ${reason} for ${id}`);

        if (keepsDying()) {
            logger.error(`ingest ffmpeg keeps dying for ${id} — closing`);
            return hooks.onGiveUp();
        }

        later(restart, RESTART_DELAY_MS);
    }
    watch(ffmpeg, onDeath);

    return {
        close: async () => {
            closing = true;
            timers.forEach(clearTimeout);
            timers.clear();
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
