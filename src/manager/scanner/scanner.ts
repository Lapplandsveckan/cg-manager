/* eslint-disable camelcase */

import { promises as fs, existsSync, type Stats } from 'fs';
import * as path from 'path';
import * as os from 'os';
import ffmpeg from 'fluent-ffmpeg';
import moment from 'moment';
import { noTryAsync } from 'no-try';
import * as chokidar from 'chokidar';
import { getId, readFile, hashFile } from './util';
import { Logger } from '../../util/log';
import managerConfig from '../../util/config';
import config from './config';
import { type FileDatabase, type MediaDoc } from './db';

const logger = Logger.scope('Scanner');

const THUMB_SEEK_SECONDS = 3;

// Extensions the scanner will attempt to probe. Anything else is
// silently ignored — there's no point running ffprobe + thumbnail
// extraction on text files, plugin sidecars, READMEs, OS noise, etc.
// The list covers what CasparCG actually plays back; exotic formats
// can be added if they ever show up in the wild.
const MEDIA_EXTENSIONS = new Set([
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
function configureBinaries() {
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
function patchId(
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

async function scanFile(
    mediaPath: string,
    mediaId: string,
    mediaStat: Stats,
    db: FileDatabase,
    opts: { renamedFrom?: string } = {},
) {
    if (!mediaId || mediaStat.isDirectory()) return;
    if (!MEDIA_EXTENSIONS.has(path.extname(mediaPath).toLowerCase())) return;

    const mediaLogger = logger.scope(mediaId);
    const hash = await hashFile(mediaPath);

    // Look up the doc for THIS id specifically (not any other file sharing content)
    const doc: MediaDoc = db.get(mediaId) ?? { id: mediaId };
    delete doc._invalidate;

    const metaUnchanged =
        doc.mediaSize === mediaStat.size &&
        doc.mediaTime === mediaStat.mtime.getTime();

    if (metaUnchanged && doc._hash === hash) {
        // db.get() also returns recently-evicted docs; if this id was removed
        // and re-added unchanged, resurrect it into the live store.
        if (!db.has(mediaId)) db.put(hash, doc);
        return mediaLogger.debug('Unchanged');
    }

    doc.mediaPath = mediaPath;
    doc.mediaSize = mediaStat.size;
    doc.mediaTime = mediaStat.mtime.getTime();

    // Metadata reuse: if another doc (rename source or a copy) already has mediainfo
    // for the same content, clone it and patch the id/path — skips ffprobe. The donor's
    // timestamps ride along (cinf/tinf/mediainfo.time), so a plain copy shows the
    // original's modified-time; doc.mediaSize/mediaTime above stay accurate. _attachments
    // and nested mediainfo are shared by reference — safe only because they're always
    // replaced wholesale, never mutated in place. The hash check below is required even
    // for the renamedFrom donor: a delete+add pair can land on a reused inode (false
    // "rename") for files that don't share content, e.g. a reencode that writes a new
    // file under a different name right after the original is removed — without it,
    // the new file would inherit the old file's stale metadata/thumbnail.
    const renamedFromDoc = opts.renamedFrom
        ? db.get(opts.renamedFrom)
        : undefined;
    const donorDoc = renamedFromDoc?.mediainfo
        ? renamedFromDoc
        : db.findByHash(hash);
    if (!doc.mediainfo && donorDoc?.mediainfo && donorDoc._hash === hash) {
        const donor = donorDoc;
        doc.mediainfo = { ...donor.mediainfo, name: mediaId, path: mediaPath };
        doc.cinf = patchId(donor.cinf, donor.id, mediaId);
        doc.tinf = patchId(donor.tinf, donor.id, mediaId);
        doc._attachments = donor._attachments;
        db.put(hash, doc);
        return mediaLogger.debug('Reused metadata from copy/rename');
    }

    await generateInfo(doc).catch(err => {
        mediaLogger.error(err);
        mediaLogger.error('Info Failed');
    });
    await generateThumb(doc).catch(err => {
        mediaLogger.error(err);
        mediaLogger.error('Thumbnail Failed');
    });

    // Anything ffprobe couldn't parse (text files, plugin sidecars
    // like `<file>.cgnoencode`, random binaries that ended up in the
    // media folder) lacks `mediainfo`. Storing those would surface
    // them in the UI as broken media cards and crash MediaView when
    // it tries to read `media.mediainfo.format.duration`. Bail before
    // the DB write so they never enter the listing at all.
    if (!doc.mediainfo) {
        mediaLogger.debug('Skipping unparseable file (no mediainfo)');
        return;
    }

    db.put(hash, doc);
    mediaLogger.debug(`Scanned (${db.getHash(doc.id)})`);
}

async function generateThumb(doc: MediaDoc) {
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

async function generateInfo(doc: MediaDoc) {
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
            size: json.format.time,

            start_time: json.format.start_time,
            duration: json.format.duration,
            bit_rate: json.format.bit_rate,
            max_bit_rate: json.format.max_bit_rate,
        },
    };
}

function createWatcher(
    callback: (_: [path: string, stat?: Stats]) => Promise<void> | void,
) {
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
        .on('unlink', path => callback([path]));

    return () => watcher.close();
}

function Scanner(db: FileDatabase) {
    configureBinaries();

    const inodeMap = new Map<string, number>(); // mediaId → inode, for rename detection
    const pendingRemovals = new Map<
        number,
        { mediaId: string; timer: ReturnType<typeof setTimeout> }
    >();

    // Must be > awaitWriteFinish.stabilityThreshold + pollInterval so the `add`
    // event for a rename always arrives before we emit the deletion.
    const RENAME_WINDOW_MS = 3500;

    const processAdd = async (
        mediaPath: string,
        mediaId: string,
        mediaStat: Stats,
    ) => {
        // Non-zero inode uniquely identifies a file; zero means unsupported FS
        // (some Windows volumes) — fall back to normal behaviour in that case.
        const inode: number = mediaStat.ino;
        const pending = inode ? pendingRemovals.get(inode) : undefined;

        if (pending) {
            // Same inode → rename. Cancel the deferred deletion so the old entry
            // stays visible in the UI until the new one is ready.
            clearTimeout(pending.timer);
            pendingRemovals.delete(inode);
            inodeMap.delete(pending.mediaId);
        }

        // Register the inode before the async scan so any unlink arriving
        // during scanFile can still match this file in pendingRemovals.
        if (
            MEDIA_EXTENSIONS.has(path.extname(mediaPath).toLowerCase()) &&
            inode
        )
            inodeMap.set(mediaId, inode);

        const [error] = await noTryAsync(() =>
            scanFile(mediaPath, mediaId, mediaStat, db, {
                renamedFrom: pending?.mediaId,
            }),
        );
        if (error) logger.error(error);

        // Remove the old id only AFTER the new entry is in the DB, so the UI sees
        // the item change name rather than disappear and reappear.
        if (pending) db.removeStaleId(pending.mediaId);
    };

    const closeWatcher = createWatcher(async ([mediaPath, mediaStat]) => {
        const mediaId = getId(config.paths.media, mediaPath);

        if (!mediaStat) {
            // unlink: defer removal so a paired rename `add` can cancel it
            const inode = inodeMap.get(mediaId);
            if (inode !== undefined) {
                const timer = setTimeout(() => {
                    pendingRemovals.delete(inode);
                    // Guard: only remove if this id still belongs to the file we
                    // scheduled for. A reencode (clip.mov → clip.mp4) produces a
                    // new inode and reuses the same extension-stripped id; by the
                    // time the timer fires, processAdd has already updated
                    // inodeMap[mediaId] to the new file's inode — skip the remove
                    // so the freshly-added entry isn't clobbered.
                    if (inodeMap.get(mediaId) !== inode) return;
                    inodeMap.delete(mediaId);
                    db.remove(mediaId);
                }, RENAME_WINDOW_MS);
                pendingRemovals.set(inode, { mediaId, timer });
            } else {
                db.remove(mediaId);
            }
            return;
        }

        await processAdd(mediaPath, mediaId, mediaStat);
    });

    // Trigger an immediate scan, bypassing awaitWriteFinish — used by the upload
    // handler so a finished upload appears in the UI without waiting for chokidar.
    const scan = async (mediaPath: string) => {
        const [err, stat] = await noTryAsync(() => fs.stat(mediaPath));
        if (err || !stat) return;
        await processAdd(mediaPath, getId(config.paths.media, mediaPath), stat);
    };

    const stop = async () => {
        for (const { timer } of pendingRemovals.values()) clearTimeout(timer);
        pendingRemovals.clear();
        await closeWatcher();
    };

    return { stop, scan };
}
export default Scanner;
