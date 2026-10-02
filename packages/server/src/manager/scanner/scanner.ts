import { promises as fs, type Stats } from 'fs';
import * as path from 'path';
import { type Client } from 'rest-exchange-protocol';
import { noTryAsync } from 'no-try';
import * as chokidar from 'chokidar';
import { getFolderId, getId, hashFile } from './util';
import { Logger } from '../../util/log';
import config from './config';
import { type FileDatabase, type MediaDoc } from './db';
import {
    MEDIA_EXTENSIONS,
    configureBinaries,
    generateInfo,
    generateThumb,
    patchId,
} from './probe';

const logger = Logger.scope('Scanner');

function relativeInside(dirAbs: string, filePath?: string): string | null {
    if (!filePath) return null;

    const rel = path.relative(dirAbs, filePath);
    if (!rel || rel === '..' || rel.startsWith(`..${path.sep}`)) return null;
    return rel;
}

async function scanFile(
    mediaPath: string,
    mediaId: string,
    mediaStat: Stats,
    db: FileDatabase,
    opts: { renamedFrom?: string; origin?: Client } = {},
) {
    if (!mediaId || mediaStat.isDirectory()) return;
    if (!MEDIA_EXTENSIONS.has(path.extname(mediaPath).toLowerCase())) return;

    const mediaLogger = logger.scope(mediaId);
    const hash = await hashFile(mediaPath);

    const doc: MediaDoc = db.get(mediaId) ?? { id: mediaId };
    delete doc._invalidate;

    const metaUnchanged =
        doc.mediaSize === mediaStat.size &&
        doc.mediaTime === mediaStat.mtime.getTime();

    if (metaUnchanged && doc._hash === hash) {
        // db.get() returns recently-evicted docs; resurrect. A case-only rename keeps id/size/mtime,
        // so mediaPath must be re-checked or the doc keeps a name that no longer exists.
        if (db.has(mediaId) && doc.mediaPath === mediaPath)
            return mediaLogger.debug('Unchanged');

        doc.mediaPath = mediaPath;
        // mediainfo is shared with donors; replace wholesale.
        if (doc.mediainfo)
            doc.mediainfo = { ...doc.mediainfo, path: mediaPath };
        db.put(hash, doc, opts.origin);
        return mediaLogger.debug('Unchanged (path refreshed)');
    }

    doc.mediaPath = mediaPath;
    doc.mediaSize = mediaStat.size;
    doc.mediaTime = mediaStat.mtime.getTime();

    // Reuse donor mediainfo (shared by reference, always replaced wholesale) to skip ffprobe.
    // The hash check is required even for renamedFrom: a reused inode can fake a rename (e.g. reencode).
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
        db.put(hash, doc, opts.origin);
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

    // No mediainfo means unprobeable (text, sidecars); storing them would break MediaView.
    if (!doc.mediainfo) {
        mediaLogger.debug('Skipping unparseable file (no mediainfo)');
        return;
    }

    db.put(hash, doc, opts.origin);
    mediaLogger.debug(`Scanned (${db.getHash(doc.id)})`);
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
        .on('error', err =>
            logger.error(err instanceof Error ? err : String(err)),
        )
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
        opts: { renamedFromId?: string; origin?: Client } = {},
    ) => {
        // Inode 0 means unsupported FS (some Windows volumes).
        const inode: number = mediaStat.ino;
        const pending = opts.renamedFromId
            ? { mediaId: opts.renamedFromId, timer: undefined }
            : inode
              ? pendingRemovals.get(inode)
              : undefined;

        if (pending) {
            // Same inode: a rename. Cancel the deferred deletion.
            clearTimeout(pending.timer);
            pendingRemovals.delete(inode);
            inodeMap.delete(pending.mediaId);
        }

        // Register the inode before the async scan so an unlink during scanFile can still match.
        if (
            MEDIA_EXTENSIONS.has(path.extname(mediaPath).toLowerCase()) &&
            inode
        )
            inodeMap.set(mediaId, inode);

        const [error] = await noTryAsync(() =>
            scanFile(mediaPath, mediaId, mediaStat, db, {
                renamedFrom: pending?.mediaId,
                origin: opts.origin,
            }),
        );
        if (error) logger.error(error);

        // Remove the old id only after the new entry lands; ids are upper-cased, so a case-only rename shares it.
        if (pending && pending.mediaId !== mediaId)
            db.removeStaleId(pending.mediaId, opts.origin);
    };

    const closeWatcher = createWatcher(async ([mediaPath, mediaStat]) => {
        const mediaId = getId(config.paths.media, mediaPath);

        if (!mediaStat) {
            const inode = inodeMap.get(mediaId);
            if (inode === undefined) {
                db.remove(mediaId);
                return;
            }

            const timer = setTimeout(() => {
                pendingRemovals.delete(inode);
                // A reencode (clip.mov -> clip.mp4) reuses the id with a new inode; skip so the new entry isn't removed.
                if (inodeMap.get(mediaId) !== inode) return;
                inodeMap.delete(mediaId);
                db.remove(mediaId);
            }, RENAME_WINDOW_MS);
            pendingRemovals.set(inode, { mediaId, timer });
            return;
        }

        await processAdd(mediaPath, mediaId, mediaStat);
    });

    // Bypasses awaitWriteFinish for finished uploads; no origin, so every client is told.
    const scan = async (mediaPath: string) => {
        const [err, stat] = await noTryAsync(() => fs.stat(mediaPath));
        if (err || !stat) return;
        await processAdd(mediaPath, getId(config.paths.media, mediaPath), stat);
    };

    // Optimistic delete; the later chokidar unlink just re-removes an absent id.
    const applyDelete = (mediaPath: string, origin?: Client) => {
        const mediaId = getId(config.paths.media, mediaPath);
        inodeMap.delete(mediaId);
        db.remove(mediaId, origin);
    };

    // Optimistic rename: reuses processAdd's rename branch so the UI sees a rename, not remove+add.
    const applyRename = async (
        oldPath: string,
        newPath: string,
        origin?: Client,
    ) => {
        const [err, stat] = await noTryAsync(() => fs.stat(newPath));
        if (err || !stat) return;

        const oldId = getId(config.paths.media, oldPath);
        const newId = getId(config.paths.media, newPath);
        inodeMap.delete(oldId);

        await processAdd(newPath, newId, stat, {
            renamedFromId: oldId,
            origin,
        });
    };

    // Reconciles docs under a recursively deleted folder without waiting on per-file unlinks.
    const applyFolderDelete = (absDir: string, origin?: Client) => {
        const prefix = `${getFolderId(config.paths.media, absDir)}/`;
        for (const doc of db.allDocs()) {
            if (!doc.id.startsWith(prefix)) continue;
            inodeMap.delete(doc.id);
            db.remove(doc.id, origin);
        }
    };

    // Re-keys docs in place: rescanning would re-hash every file while the request is open.
    const applyFolderRename = async (
        oldAbs: string,
        newAbs: string,
        origin?: Client,
    ) => {
        const oldPrefix = `${getFolderId(config.paths.media, oldAbs)}/`;
        const docs = db.allDocs().filter(doc => doc.id.startsWith(oldPrefix));

        const moves = await Promise.all(
            docs.map(async doc => {
                const relPath = relativeInside(oldAbs, doc.mediaPath);
                if (!relPath) return null;

                const newPath = path.join(newAbs, relPath);
                const [err, stat] = await noTryAsync(() => fs.stat(newPath));
                if (err || !stat) return null;

                return { doc, newPath, inode: stat.ino };
            }),
        );

        for (const move of moves) {
            if (!move) continue;

            const { doc, newPath, inode } = move;
            const oldId = doc.id;
            const newId = getId(config.paths.media, newPath);
            inodeMap.delete(oldId);
            if (inode) inodeMap.set(newId, inode);

            const moved: MediaDoc = {
                ...doc,
                id: newId,
                mediaPath: newPath,
                cinf: patchId(doc.cinf, oldId, newId),
                tinf: patchId(doc.tinf, oldId, newId),
                mediainfo: doc.mediainfo && {
                    ...doc.mediainfo,
                    name: newId,
                    path: newPath,
                },
            };

            db.put(doc._hash, moved, origin);
            if (newId !== oldId) db.removeStaleId(oldId, origin);
        }
    };

    const stop = async () => {
        for (const { timer } of pendingRemovals.values()) clearTimeout(timer);
        pendingRemovals.clear();
        await closeWatcher();
    };

    return {
        stop,
        scan,
        applyDelete,
        applyRename,
        applyFolderDelete,
        applyFolderRename,
    };
}
export default Scanner;
