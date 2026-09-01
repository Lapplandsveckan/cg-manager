/* eslint-disable camelcase */

import { promises as fs, existsSync } from 'fs';
import * as path from 'path';
import * as os from 'os';
import ffmpeg from 'fluent-ffmpeg';
import moment from 'moment';
import { getId, readFile } from './util';
import { Logger } from '../../util/log';
import managerConfig from '../../util/config';
import config from './config';
import { type MediaDoc } from './db';

const logger = Logger.scope('Probe');

const THUMB_SEEK_SECONDS = 3;

// Extensions the scanner will attempt to probe. Anything else is
// silently ignored — there's no point running ffprobe + thumbnail
// extraction on text files, plugin sidecars, READMEs, OS noise, etc.
// The list covers what CasparCG actually plays back; exotic formats
// can be added if they ever show up in the wild.
export const MEDIA_EXTENSIONS = new Set([
    // Video
    '.mp4',
    '.mov',
    '.mkv',
    '.m4v',
    '.webm',
    '.avi',
    '.wmv',
    '.mpg',
    '.mpeg',
    '.ts',
    '.m2ts',
    '.mxf',
    // Image
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.bmp',
    '.tiff',
    // Audio
    '.mp3',
    '.wav',
    '.aac',
    '.ogg',
    '.flac',
    '.m4a',
]);

// Point fluent-ffmpeg at the ffmpeg/ffprobe binaries shipped alongside the
// CasparCG executable. Without this, the scanner relies on whatever's on
// PATH — fine on dev boxes, but the packaged manager runs next to its own
// CasparCG install and shouldn't depend on a system-wide ffmpeg being
// present (or matching the version Caspar uses). If `caspar-path` isn't
// set we fall back to PATH so dev mode keeps working.
export function configureBinaries() {
    const folder = managerConfig['caspar-path'];
    if (!folder) return;

    const ext = process.platform === 'win32' ? '.exe' : '';
    const ffmpegPath = path.join(folder, `ffmpeg${ext}`);
    const ffprobePath = path.join(folder, `ffprobe${ext}`);

    if (existsSync(ffmpegPath)) ffmpeg.setFfmpegPath(ffmpegPath);
    else
        logger.warn(
            `ffmpeg not found at ${ffmpegPath} — falling back to PATH lookup`,
        );

    if (existsSync(ffprobePath)) ffmpeg.setFfprobePath(ffprobePath);
    else
        logger.warn(
            `ffprobe not found at ${ffprobePath} — falling back to PATH lookup`,
        );
}

// Replace the JSON-stringified id prefix in a cinf/tinf string after a rename.
export function patchId(
    s: string | undefined,
    oldId: string,
    newId: string,
): string | undefined {
    if (!s) return s;
    const prefix = JSON.stringify(oldId);
    return s.startsWith(prefix)
        ? JSON.stringify(newId) + s.slice(prefix.length)
        : s;
}

export async function generateThumb(doc: MediaDoc) {
    const tmpPath = `${path.join(
        os.tmpdir(),
        Math.random().toString(16).substring(2),
    )}.png`;

    await fs.mkdir(path.dirname(tmpPath), { recursive: true });
    const duration = doc.mediainfo?.format?.duration;
    const seek =
        duration && duration > THUMB_SEEK_SECONDS ? THUMB_SEEK_SECONDS : 0;

    await new Promise<void>((resolve, reject) => {
        ffmpeg()
            .input(doc.mediaPath)
            .seekInput(seek)
            .output(tmpPath)
            .frames(1)
            .size('256x?')
            .on('error', err => {
                reject(err);
            })
            .on('end', () => {
                resolve();
            })
            .run();
    });

    const thumbStat = await fs.stat(tmpPath);
    doc.thumbSize = thumbStat.size;
    doc.thumbTime = thumbStat.mtime.getTime();

    const tinf = [
        JSON.stringify(getId(config.paths.media, doc.mediaPath)),
        moment(doc.thumbTime).format('YYYYMMDDTHHmmss'),
        doc.thumbSize,
    ];
    doc.tinf = `${tinf.join(' ')}\r\n`;

    doc._attachments = {
        'thumb.png': {
            content_type: 'image/png',
            data: await readFile(tmpPath),
        },
    };

    await fs.unlink(tmpPath);
}

export async function generateInfo(doc: MediaDoc) {
    const json = await new Promise<ffmpeg.FfprobeData>((resolve, reject) => {
        ffmpeg()
            .input(doc.mediaPath)
            .addOption('-show_streams')
            .addOption('-show_format')
            .ffprobe((err, data) => {
                if (err) return reject(err);
                if (!data.streams?.[0]) return reject(new Error('not media'));

                resolve(data);
            });
    });

    doc.cinf = generateCinf(doc, json);
    doc.mediainfo = generateMediainfo(doc, json);
}

function generateCinf(doc, json) {
    const stream = json.streams[0];

    const dur = parseFloat(json.format.duration) || 1 / 24;
    let tb = (stream.time_base || '1/25').split('/');

    let type = 'AUDIO';
    if (stream.pix_fmt) type = dur <= 1 / 24 ? 'STILL' : 'MOVIE';

    switch (type) {
        case 'AUDIO':
            break;
        case 'MOVIE': {
            const fr = String(
                stream.avg_frame_rate || stream.r_frame_rate || '',
            ).split('/');
            if (fr.length === 2) tb = [fr[1], fr[0]];
            break;
        }
        case 'STILL':
            tb = [0, 1];
            break;
    }

    const frames = tb[0] === 0 ? 0 : Math.floor((dur * tb[1]) / tb[0]);
    const cinf = [
        JSON.stringify(getId(config.paths.media, doc.mediaPath)),
        ` ${type} `,
        doc.mediaSize,
        moment(doc.mediaTime).format('YYYYMMDDHHmmss'),
        frames,
        tb.join('/'),
    ];

    return `${cinf.join(' ')}\r\n`;
}

function generateMediainfo(
    doc: MediaDoc,
    json: ffmpeg.FfprobeData,
): MediaDoc['mediainfo'] {
    return {
        name: doc.id,
        path: doc.mediaPath,
        size: doc.mediaSize,
        time: doc.mediaTime,
        field_order: 'unknown',

        streams: json.streams.map(s => ({
            codec: {
                long_name: s.codec_long_name,
                type: s.codec_type,
                time_base: s.codec_time_base,
                tag_string: s.codec_tag_string,
                is_avc: s.is_avc,
            },

            // Video
            width: s.width,
            height: s.height,
            sample_aspect_ratio: s.sample_aspect_ratio,
            display_aspect_ratio: s.display_aspect_ratio,
            pix_fmt: s.pix_fmt,
            bits_per_raw_sample: s.bits_per_raw_sample,

            // Audio
            sample_fmt: s.sample_fmt,
            sample_rate: s.sample_rate,
            channels: s.channels,
            channel_layout: s.channel_layout,
            bits_per_sample: s.bits_per_sample,

            // Common
            time_base: s.time_base,
            start_time: s.start_time,
            duration_ts: s.duration_ts,
            duration: s.duration,

            bit_rate: s.bit_rate,
            max_bit_rate: s.max_bit_rate,
            nb_frames: s.nb_frames,
        })),
        format: {
            name: json.format.format_name,
            long_name: json.format.format_long_name,
            size: json.format.size,

            start_time: json.format.start_time,
            duration: json.format.duration,
            bit_rate: json.format.bit_rate,
            max_bit_rate: json.format.max_bit_rate,
        },
    };
}
