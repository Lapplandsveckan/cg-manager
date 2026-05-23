import {spawn} from 'child_process';
import {ffmpegBinary} from './ffmpeg';

/**
 * Marker we stamp into every encoded file's container metadata, in the
 * standard `comment` field. Future bumps to the encoder settings should
 * bump the version too — older versions still count as "encoded" for
 * the purposes of skipping re-runs, but the version difference is the
 * signal we'd use to opt back in if a re-encode pass became necessary.
 */
export const ENCODER_TAG_NAME = 'cg-encode';
export const ENCODER_VERSION = 1;
export const ENCODER_TAG = `${ENCODER_TAG_NAME}@${ENCODER_VERSION}`;

const TAG_REGEX = new RegExp(`^comment=${ENCODER_TAG_NAME}@(\\d+)\\s*$`, 'm');

/**
 * Cheap "have we encoded this before?" check. We invoke ffmpeg with the
 * `ffmetadata` muxer — that reads *only* the container metadata header
 * (typically ~100ms even on large files) and dumps it as key=value
 * pairs on stdout. Far cheaper than ffprobe's stream walk, and bounded
 * by container parse time rather than file size.
 *
 * Returns the version found, or null if the file wasn't produced by us.
 */
export function probeEncoderVersion(filePath: string): Promise<number | null> {
    return new Promise((resolve) => {
        const proc = spawn(ffmpegBinary(), [
            '-hide_banner',
            '-loglevel',
            'error',
            '-i',
            filePath,
            '-f',
            'ffmetadata',
            '-',
        ], { stdio: ['ignore', 'pipe', 'ignore'] });

        let buf = '';
        proc.stdout.on('data', (c: Buffer) => { buf += c.toString('utf8'); });
        proc.on('close', () => {
            const m = buf.match(TAG_REGEX);
            resolve(m ? parseInt(m[1], 10) : null);
        });
        proc.on('error', () => resolve(null));
    });
}
