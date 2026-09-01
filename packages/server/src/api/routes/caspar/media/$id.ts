import { promises as fs } from 'fs';
import * as path from 'path';
import { WebError } from 'rest-exchange-protocol';
import { noTry } from 'no-try';
import { type RouteExport } from '../../../route';
import { CasparManager } from '../../../../manager';
import scannerConfig from '../../../../manager/scanner/config';
import {
    getId,
    resolveSafePath,
    validateFilename,
} from '../../../../manager/scanner/util';
import {
    isInternalMediaId,
    isReservedTopLevel,
    normalizeFolderPath,
    PLACEHOLDER_NAME,
} from '../../../../manager/scanner/folders';
import { resolveMediaFile } from '../../../../manager/scanner/locate';

function resolveDoc(id: string) {
    return resolveMediaFile(decodeURIComponent(id));
}

// The doc exactly as the listing endpoint would serve it — same two filters as
// `media/all` (and as the `caspar/media` broadcast), so the originating client
// can never cache an entry a refetch would drop. `db.get` also returns
// recently-evicted docs, which the caller must not cache either. Handing back
// null in any of those cases lets it fall through to a refetch.
function liveDoc(id: string) {
    if (isInternalMediaId(id)) return null;

    const db = CasparManager.getManager().getMediaScanner().getDatabase();
    if (!db.has(id)) return null;

    const doc = db.get(id);
    return doc?.mediainfo ? doc : null;
}

export default {
    GET: async request => {
        if (!request.params.id) throw new WebError('No media id provided', 400);

        return CasparManager.getManager()
            .getMediaScanner()
            .getDatabase()
            .get(decodeURIComponent(request.params.id));
    },
    DELETE: async request => {
        if (!request.params.id) throw new WebError('No media id provided', 400);

        const { mediaPath } = resolveDoc(request.params.id);
        await fs.unlink(mediaPath).catch(err => {
            if (err.code === 'ENOENT') return; // already gone — fall through, still remove from DB
            throw new WebError(`Failed to delete: ${err.message}`, 500);
        });

        // Update the DB + broadcast immediately instead of waiting for chokidar.
        // The requesting client is excluded from that broadcast (it applies
        // this response instead), so it's passed through as the change origin.
        // Recompute the id from the resolved path (rather than trusting the
        // raw param) so it matches exactly what applyDelete removes.
        const id = getId(scannerConfig.paths.media, mediaPath);
        CasparManager.getManager()
            .getMediaScanner()
            .applyDelete(mediaPath, request.getClient());

        return { ok: true, id };
    },
    UPDATE: async request => {
        if (!request.params.id) throw new WebError('No media id provided', 400);

        const data = request.getData();
        if (typeof data !== 'object' || data === null)
            throw new WebError('Request body must be an object', 400);
        const newName = (data as { name?: unknown }).name;
        const newPath = (data as { path?: unknown }).path;

        // Two accepted shapes:
        //  - `{ name }`: in-place rename — keep the file's current dir,
        //    change the basename. Same semantics as before.
        //  - `{ path }`: full move — set both dir and basename. The path
        //    is slash-separated, relative to the media root, no extension
        //    (extension is preserved from the source file). Use this for
        //    drag-into-folder, move-up-to-parent, etc.
        //  If both are supplied, `path` wins.
        if (typeof newName !== 'string' && typeof newPath !== 'string')
            throw new WebError('Missing "name" or "path"', 400);

        const { mediaPath } = resolveDoc(request.params.id);
        const ext = path.extname(mediaPath);

        // Build target as a path relative to media root, no extension.
        let targetRel: string;
        if (typeof newPath === 'string') {
            const [normErr, segments] = noTry(() =>
                normalizeFolderPath(newPath),
            );
            if (normErr || !segments)
                throw new WebError(normErr?.message ?? 'Invalid path', 400);
            // `_internal/` holds plugin-side symlinks; the listing and the
            // broadcast both hide ids under it, so a move in there would strand
            // the file somewhere no client can see it again.
            if (isReservedTopLevel(segments))
                throw new WebError('Reserved folder', 400);
            for (const segment of segments) {
                const [err] = noTry(() => validateFilename(segment));
                if (err)
                    throw new WebError(
                        `Invalid segment "${segment}": ${err.message}`,
                        400,
                    );
                if (segment === PLACEHOLDER_NAME)
                    throw new WebError('Reserved name', 400);
            }
            targetRel = segments.join(path.sep);
        } else {
            const [err] = noTry(() => validateFilename(newName as string));
            if (err) throw new WebError((err as Error).message, 400);
            const dir = path.dirname(mediaPath);
            targetRel = path.join(
                path.relative(scannerConfig.paths.media, dir),
                newName as string,
            );
        }

        const target = resolveSafePath(
            scannerConfig.paths.media,
            `${targetRel}${ext}`,
        );
        if (target === mediaPath) {
            const id = getId(scannerConfig.paths.media, mediaPath);
            return { ok: true, id, doc: liveDoc(id) };
        }

        await fs.access(target).then(
            () => {
                throw new WebError('A file with that name already exists', 409);
            },
            () => undefined,
        );

        // Make sure the target directory exists. For an in-place rename
        // this is a no-op; for cross-folder moves the user may be moving
        // into a folder that exists already (or one they implicitly want
        // created — `recursive: true` handles both).
        await fs.mkdir(path.dirname(target), { recursive: true }).catch(err => {
            throw new WebError(
                `Failed to create directory: ${err.message}`,
                500,
            );
        });

        await fs.rename(mediaPath, target).catch(err => {
            throw new WebError(`Failed to rename: ${err.message}`, 500);
        });

        // Update the DB + broadcast immediately instead of waiting for chokidar.
        // The requesting client is excluded from that broadcast (it applies
        // this response instead), so it's passed through as the change origin.
        await CasparManager.getManager()
            .getMediaScanner()
            .applyRename(mediaPath, target, request.getClient());

        const newId = getId(scannerConfig.paths.media, target);
        return { ok: true, id: newId, doc: liveDoc(newId) };
    },
} satisfies RouteExport;
