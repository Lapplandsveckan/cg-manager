import {spawn, ChildProcess} from 'child_process';
import os from 'os';
import {ffmpegBinary} from './ffmpeg';
import {ENCODER_TAG} from './probe';

export interface EncodeOptions {
    input: string;
    output: string;
    signal?: AbortSignal;
    onProgress?: (frameTimeMs: number) => void;
}

export interface EncodeImageOptions {
    input: string;
    output: string;
    signal?: AbortSignal;
}

/**
 * libx264 encode at the same settings the user's previous standalone
 * encoder used: 1080p30 letterboxed/pillarboxed to 16:9, BT.709 from
 * BT.2020 source colorimetry, AAC 192k stereo. The container is
 * stamped with `comment=cg-encode@v1` so subsequent probes know to
 * skip it.
 *
 * Spawned with PRIORITY_LOW so the kernel gives CasparCG every cycle
 * it asks for — encoding only consumes idle CPU.
 */
const ENCODE_ARGS = (input: string, output: string): string[] => [
    '-hide_banner',
    '-y',                                  // overwrite the temp output if it exists
    '-i',
    input,

    // Video — H.264 baseline-ish, 1080p30, padded to 16:9 from whatever
    // the source aspect is. yuv420p + colorspace conversion handles
    // HDR/10-bit sources gracefully.
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-tune',
    'film',
    '-crf',
    '18',
    '-vf',
    [
        'scale=w=1920:h=1080:force_original_aspect_ratio=decrease',
        'pad=1920:1080:(ow-iw)/2:(oh-ih)/2',
        'format=yuv420p',
        'colorspace=all=bt709:iall=bt2020:fast=1',
    ].join(','),
    '-r',
    '30',

    // Audio — AAC LC at 192k stereo 48k. Matches CasparCG's typical
    // consumer settings.
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-ar',
    '48000',
    '-ac',
    '2',

    // Container — faststart so the moov atom is at the head (CasparCG
    // can start playing without seeking to the tail), and preserve any
    // existing metadata tags so we don't lose author/title etc.
    '-movflags',
    '+faststart+use_metadata_tags',
    '-metadata',
    `comment=${ENCODER_TAG}`,

    // Progress — line-buffered key=value pairs on stdout, lets us
    // report progress without parsing the noisy stderr log.
    '-progress',
    'pipe:1',
    '-nostats',

    output,
];

/**
 * Lower the OS scheduling priority of a freshly-spawned ffmpeg so it
 * yields to CasparCG. Linux maps `PRIORITY_LOW` to nice +19; Windows
 * maps it to IDLE_PRIORITY_CLASS. Wrapping in noTry because Node
 * throws when the target PID has already exited (which can happen if
 * ffmpeg crashes on spawn).
 */
function makeLowPriority(proc: ChildProcess) {
    if (proc.pid === undefined) return;
    try {
        os.setPriority(proc.pid, os.constants.priority.PRIORITY_LOW);
    } catch {
        // Process may have died before we got here — fine, we'll see
        // the exit code via the regular handlers.
    }
}

/** Parse one line of ffmpeg's `-progress pipe:1` output. Lines look like
 *  `out_time_ms=1234567` — we only care about the time-position keys,
 *  which we surface as a "frames so far in ms" hint to callers. */
function parseProgress(line: string): number | null {
    const eq = line.indexOf('=');
    if (eq <= 0) return null;
    const key = line.substring(0, eq);
    const value = line.substring(eq + 1).trim();
    if (key === 'out_time_ms') return parseInt(value, 10) / 1000;
    if (key === 'out_time_us') return parseInt(value, 10) / 1000;
    return null;
}

/**
 * Run a single encode. The returned promise resolves when ffmpeg
 * exits 0, rejects on any non-zero exit / spawn error / abort.
 * `signal` lets the caller cancel a job in progress — we send SIGTERM
 * (then SIGKILL after a grace period) and the promise rejects.
 */
/**
 * Image-side encode: normalise a single still image to fit within
 * 1920x1080 (16:9) without upscaling. Letterbox/pillarbox bars are
 * always solid black — we deliberately never use a transparent fill,
 * because the asset typically plays on a channel whose background we
 * don't want to bleed through where the source didn't cover the frame
 * (e.g. a phone-camera video on a programme channel).
 *
 * The scale filter uses `min(iw,1920)` / `min(ih,1080)` so small images
 * pass through at their original dimensions — we only ever shrink.
 */
const IMAGE_ENCODE_ARGS = (input: string, output: string): string[] => [
    '-hide_banner',
    '-y',
    '-i',
    input,
    '-vf',
    [
        'scale=w=\'min(iw,1920)\':h=\'min(ih,1080)\':force_original_aspect_ratio=decrease',
        'pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black',
    ].join(','),
    '-metadata',
    `comment=${ENCODER_TAG}`,
    // High quality recompression. For PNG this is lossless anyway;
    // for JPEG `-q:v 2` keeps the file visually identical to the
    // source while still rewriting the bytes so our metadata stamp
    // is actually attached.
    '-q:v',
    '2',
    output,
];

export function encodeImage(opts: EncodeImageOptions): Promise<void> {
    return runFfmpeg(IMAGE_ENCODE_ARGS(opts.input, opts.output), opts.signal);
}

/** Shared "spawn ffmpeg, watch stderr, resolve/reject" wrapper used by
 *  both the video and image encoders. Pulled out so the SIGTERM-then-
 *  SIGKILL teardown and low-priority handoff aren't duplicated. */
function runFfmpeg(
    args: string[],
    signal?: AbortSignal,
    onProgress?: (frameTimeMs: number) => void,
): Promise<void> {
    return new Promise((resolve, reject) => {
        const proc = spawn(ffmpegBinary(), args, {
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        makeLowPriority(proc);

        let stderr = '';
        proc.stderr?.on('data', (c) => { stderr += c.toString('utf8'); });

        if (onProgress) {
            let pending = '';
            proc.stdout?.on('data', (chunk: Buffer) => {
                pending += chunk.toString('utf8');
                let idx: number;
                while ((idx = pending.indexOf('\n')) !== -1) {
                    const line = pending.substring(0, idx);
                    pending = pending.substring(idx + 1);
                    const ms = parseProgress(line);
                    if (ms !== null) onProgress(ms);
                }
            });
        }

        const onAbort = () => {
            proc.kill('SIGTERM');
            setTimeout(() => {
                if (!proc.killed) proc.kill('SIGKILL');
            }, 2000).unref();
        };
        signal?.addEventListener('abort', onAbort);

        proc.on('error', (err) => {
            signal?.removeEventListener('abort', onAbort);
            reject(err);
        });

        proc.on('close', (code, sig) => {
            signal?.removeEventListener('abort', onAbort);
            if (signal?.aborted) {
                reject(new Error('aborted'));
                return;
            }
            if (code === 0) {
                resolve();
                return;
            }
            const tail = stderr.split('\n').slice(-6).join('\n');
            reject(new Error(`ffmpeg exited ${code}${sig ? ` (${sig})` : ''}: ${tail}`));
        });
    });
}

export function encode(opts: EncodeOptions): Promise<void> {
    return runFfmpeg(ENCODE_ARGS(opts.input, opts.output), opts.signal, opts.onProgress);
}
