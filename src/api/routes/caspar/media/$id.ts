import { promises as fs } from 'fs';
import * as path from 'path';
import { WebError } from 'rest-exchange-protocol';
import { noTry } from 'no-try';
import { type RouteExport } from '../../../route';
import { CasparManager } from '../../../../manager';
import scannerConfig from '../../../../manager/scanner/config';
import {
    resolveSafePath,
    validateFilename,
} from '../../../../manager/scanner/util';
import {
    normalizeFolderPath,
    PLACEHOLDER_NAME,
} from '../../../../manager/scanner/folders';

function resolveDoc(id: string) {
    const decoded = decodeURIComponent(id);
    const doc = CasparManager.getManager()
        .getMediaScanner()
        .getDatabase()
        .get(decoded);

    if (!doc) throw new WebError('Media not found', 404);
    if (!doc.mediaPath) throw new WebError('Media has no file on disk', 409);

    // Defensive: re-validate that the doc's mediaPath is still inside the
    // configured media root before any fs operation.
    const safe = resolveSafePath(
        scannerConfig.paths.media,
        path.relative(scannerConfig.paths.media, doc.mediaPath),
    );
    return { doc, mediaPath: safe };
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
            if (err.code === 'ENOENT') return; // already gone — let the scanner reconcile
            throw new WebError(`Failed to delete: ${err.message}`, 500);
        });

        return { ok: true };
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
        if (target === mediaPath) return { ok: true };

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
        await fs.mkdir(path.dirname(target), { recursive: true });

        await fs.rename(mediaPath, target).catch(err => {
            throw new WebError(`Failed to rename: ${err.message}`, 500);
        });

        return { ok: true };
    },
} satisfies RouteExport;
