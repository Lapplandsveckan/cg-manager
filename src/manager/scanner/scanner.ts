/* eslint-disable camelcase */

import config from './config';
import {Logger} from '../../util/log';
import {noTryAsync} from 'no-try';
import { getId } from './util';
import { promises as fs } from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import moment from 'moment';
import * as path from 'path';
import * as os from 'os';
import * as chokidar from 'chokidar';
import {MediaDoc} from './index';

const logger = Logger.scope('Scanner');

async function cleanDeleted(db: PouchDB.Database<MediaDoc>) {
    logger.info('Checking for dead media');

    const limit = 256;
    let startkey;
    while (true) {
        const deleted = [];

        const { rows } = await db.allDocs({
            include_docs: true,
            startkey,
            limit,
        });
        await Promise.all(rows.map(async ({ doc }) => {
            try {
                const mediaFolder = path.normalize(config.paths.media);
                const mediaPath = path.normalize(doc.mediaPath);
                if (mediaPath.indexOf(mediaFolder) === 0)
                    try {
                        const stat = await fs.stat(doc.mediaPath);
                        if (stat.isFile()) return;
                    } catch (e) {
                        // File not found
                    }

                deleted.push({
                    _id: doc._id,
                    _rev: doc._rev,
                    _deleted: true,
                });
            } catch (err) {
                logger.error(err);
                // logger.error(doc);
            }
        }));

        await db.bulkDocs(deleted);

        if (rows.length < limit) break;
        startkey = rows[rows.length - 1].doc._id;
    }

    logger.info('Finished check for dead media');
}

async function scanFile(mediaPath, mediaId, mediaStat, db) {
    if (!mediaId || mediaStat.isDirectory()) return;

    const mediaLogger = logger.scope(mediaId);
    const doc = await db.get(mediaId)
        .catch(() => ({ _id: mediaId }));

    if (doc.mediaPath && doc.mediaPath !== mediaPath) {
        mediaLogger.info('Skipped');
        return;
    }

    if (doc.mediaSize === mediaStat.size && doc.mediaTime === mediaStat.mtime.getTime()) return;

    doc.mediaPath = mediaPath;
    doc.mediaSize = mediaStat.size;
    doc.mediaTime = mediaStat.mtime.getTime();

    await Promise.all([
        generateInfo(doc).catch(err => {
            mediaLogger.error(err);
            mediaLogger.error('Info Failed');
        }),
        generateThumb(doc).catch(err => {
            mediaLogger.error(err);
            mediaLogger.error('Thumbnail Failed');
        }),
    ]);

    await db.put(doc);

    mediaLogger.info('Scanned');
}

async function generateThumb (doc) {
    const tmpPath = `${path.join(os.tmpdir(), Math.random().toString(16)).substring(2)}.png`;

    await fs.mkdir(path.dirname(tmpPath), { recursive: true });
    await new Promise<void>((resolve, reject) => {
        ffmpeg()
            .addOption('-hide_banner')
            .input(doc.mediaPath)
            .output(tmpPath)
            .frames(1)
            .videoFilters([
                'select=gt\\(scene\,0.4\\)',
                'scale=256:-1',
            ])

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
            data: (await fs.readFile(tmpPath)),
        },
    };

    await fs.unlink(tmpPath);
}

async function generateInfo (doc) {
    const json = await new Promise((resolve, reject) => {
        ffmpeg()
            .addOption('-hide_banner')
            .input(doc.mediaPath)
            .addOption('-show_streams')
            .addOption('-show_format')
            .addOption('-print_format', 'json')
            .ffprobe((err, data) => {
                if (err) return reject(err);
                if (!data.streams || !data.streams[0]) return reject(new Error('not media'));

                resolve(data);
            });
    });

    doc.cinf = generateCinf(doc, json);
    doc.mediainfo = await generateMediainfo(doc, json);
}

function generateCinf(doc, json) {
    const stream = json.streams[0];

    const dur = parseFloat(json.format.duration) || (1 / 24);
    let tb = (stream.time_base || '1/25').split('/');

    let type = 'AUDIO';
    if (stream.pix_fmt) type = dur <= (1 / 24) ? 'STILL' : 'MOVIE';

    switch (type) {
        case 'AUDIO':
            break;
        case 'MOVIE':
            const fr = String(stream.avg_frame_rate || stream.r_frame_rate || '').split('/');
            if (fr.length === 2) tb = [fr[1], fr[0]];
            break;
        case 'STILL':
            tb = [0, 1];
            break;
    }

    const frames = tb[0] === 0 ? 0 : Math.floor((dur * tb[1]) / tb[0]);
    const cinf = [
        JSON.stringify(getId(config.paths.media, doc.mediaPath)),
        ` ${type} `,
        doc.mediaSize,
        moment(doc.thumbTime).format('YYYYMMDDHHmmss'),
        frames,
        tb.join('/'),
    ];

    return `${cinf.join(' ')}\r\n`;
}

function generateMediainfo(doc: MediaDoc, json): MediaDoc['mediainfo'] {
    return {
        name: doc._id,
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
            size: json.format.time,

            start_time: json.format.start_time,
            duration: json.format.duration,
            bit_rate: json.format.bit_rate,
            max_bit_rate: json.format.max_bit_rate,
        },
    };
}

function createWatcher(callback: (_: [path: string, stat?: any]) => void) {
    const watcher = chokidar
        .watch(config.paths.media, {
            alwaysStat: true,
            awaitWriteFinish: {
                stabilityThreshold: 2000,
                pollInterval: 1000,
            },
        })
        .on('error', err => logger.error(err))
        .on('add', (path, stat) => callback([path, stat]))
        .on('change', (path, stat) => callback([path, stat]))
        .on('unlink', (path) => callback([path]));

    return () => watcher.close();
}

function Scanner(db: PouchDB.Database<MediaDoc>) {
    const stop = createWatcher(async ([mediaPath, mediaStat]) => {
        const mediaId = getId(config.paths.media, mediaPath);
        const [error] = await noTryAsync(async () => {
            if (!mediaStat) await db.remove(await db.get(mediaId));
            else await scanFile(mediaPath, mediaId, mediaStat, db);
        });

        if (error) logger.error(error);
    });

    cleanDeleted(db);

    return {
        stop,
    };
};

export default Scanner;