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

// Path of `filePath` relative to `dirAbs`, or null if it isn't under it.
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

    // Look up the doc for THIS id specifically (not any other file sharing content)
    const doc: MediaDoc = db.get(mediaId) ?? { id: mediaId };
    delete doc._invalidate;

    const metaUnchanged =
        doc.mediaSize === mediaStat.size &&
        doc.mediaTime === mediaStat.mtime.getTime();

    if (metaUnchanged && doc._hash === hash) {
        // db.get() also returns recently-evicted docs; if this id was removed
        // and re-added unchanged, resurrect it into the live store. A case-only
        // rename keeps the id, size, mtime and content, so this is also the
        // only place the new path can land — without the mediaPath check the
        // doc would keep pointing at a name that no longer exists on a
        // case-sensitive filesystem, and no 'change' would ever be emitted.
        if (db.has(mediaId) && doc.mediaPath === mediaPath)
            return mediaLogger.debug('Unchanged');

        doc.mediaPath = mediaPath;
        // mediainfo is shared by reference with donor docs — replace it
        // wholesale rather than mutating the object in place.
        if (doc.mediainfo)
            doc.mediainfo = { ...doc.mediainfo, path: mediaPath };
        db.put(hash, doc, opts.origin);
        return mediaLogger.debug('Unchanged (path refreshed)');
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
        // Non-zero inode uniquely identifies a file; zero means unsupported FS
        // (some Windows volumes) — fall back to normal behaviour in that case.
        const inode: number = mediaStat.ino;
        const pending = opts.renamedFromId
            ? { mediaId: opts.renamedFromId, timer: undefined }
            : inode
              ? pendingRemovals.get(inode)
              : undefined;

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
                origin: opts.origin,
            }),
        );
        if (error) logger.error(error);

        // Remove the old id only AFTER the new entry is in the DB, so the UI sees
        // the item change name rather than disappear and reappear. Ids are
        // upper-cased, so a case-only rename lands on the same id — removing it
        // would evict the entry we just wrote.
        if (pending && pending.mediaId !== mediaId)
            db.removeStaleId(pending.mediaId, opts.origin);
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
    // No origin: uploads aren't attributed to a live request by the time the
    // chunked transfer completes, so this always broadcasts to everyone.
    const scan = async (mediaPath: string) => {
        const [err, stat] = await noTryAsync(() => fs.stat(mediaPath));
        if (err || !stat) return;
        await processAdd(mediaPath, getId(config.paths.media, mediaPath), stat);
    };

    // Optimistic delete — called right after the route handler's fs.unlink
    // succeeds, so the DB/broadcast update fires immediately instead of
    // waiting for chokidar's `unlink` + RENAME_WINDOW_MS deferral. The later
    // chokidar event is harmless: the inode is already gone from inodeMap, so
    // it just re-removes an already-absent id.
    const applyDelete = (mediaPath: string, origin?: Client) => {
        const mediaId = getId(config.paths.media, mediaPath);
        inodeMap.delete(mediaId);
        db.remove(mediaId, origin);
    };

    // Optimistic rename/move — called right after the route handler's
    // fs.rename succeeds. Reuses processAdd's rename branch (via
    // renamedFromId) so the UI sees the item change name/path rather than
    // disappear and reappear. The later chokidar `unlink oldPath` + `add
    // newPath` events are harmless — the old inode is already cleared, and
    // the new file's hash is unchanged so scanFile skips the rescan.
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

    // Reconcile every media doc under a folder that was just deleted
    // recursively — called right after the route handler's fs.rm succeeds,
    // so contained docs vanish immediately instead of waiting on chokidar's
    // unlink + RENAME_WINDOW_MS deferral per file.
    const applyFolderDelete = (absDir: string, origin?: Client) => {
        const prefix = `${getFolderId(config.paths.media, absDir)}/`;
        for (const doc of db.allDocs()) {
            if (!doc.id.startsWith(prefix)) continue;
            inodeMap.delete(doc.id);
            db.remove(doc.id, origin);
        }
    };

    // Reconcile every media doc under a folder that was just renamed/moved —
    // called right after the route handler's fs.rename succeeds. The files
    // themselves are untouched, so each doc is re-keyed in place rather than
    // replayed through scanFile: that would re-hash every file's full contents
    // while the route holds the request open. The later chokidar `add` events
    // then find matching size/mtime/hash and no-op — except for docs with no
    // known hash yet (restored from disk, never rescanned), which get a normal
    // full probe at that point.
    const applyFolderRename = async (
        oldAbs: string,
        newAbs: string,
        origin?: Client,
    ) => {
        const oldPrefix = `${getFolderId(config.paths.media, oldAbs)}/`;
        const docs = db.allDocs().filter(doc => doc.id.startsWith(oldPrefix));

        // Stat every candidate up front rather than one at a time — the route
        // holds the request open for the whole reconcile.
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
