import {CasparManager} from '../../../../manager';
import {WebError} from 'rest-exchange-protocol';
import {promises as fs} from 'fs';
import * as path from 'path';
import scannerConfig from '../../../../manager/scanner/config';
import {resolveSafePath, validateFilename} from '../../../../manager/scanner/util';

function resolveDoc(id: string) {
    const decoded = decodeURIComponent(id);
    const doc = CasparManager
        .getManager()
        .getMediaScanner()
        .getDatabase()
        .get(decoded);

    if (!doc) throw new WebError('Media not found', 404);
    if (!doc.mediaPath) throw new WebError('Media has no file on disk', 409);

    // Defensive: re-validate that the doc's mediaPath is still inside the
    // configured media root before any fs operation.
    const safe = resolveSafePath(scannerConfig.paths.media, path.relative(scannerConfig.paths.media, doc.mediaPath));
    return { doc, mediaPath: safe };
}

export default {
    'GET': async (request) => {
        if (!request.params.id) throw new WebError('No media id provided', 400);

        return CasparManager
            .getManager()
            .getMediaScanner()
            .getDatabase()
            .get(decodeURIComponent(request.params.id));
    },
    'DELETE': async (request) => {
        if (!request.params.id) throw new WebError('No media id provided', 400);

        const { mediaPath } = resolveDoc(request.params.id);
        await fs.unlink(mediaPath).catch(err => {
            if (err.code === 'ENOENT') return; // already gone — let the scanner reconcile
            throw new WebError(`Failed to delete: ${err.message}`, 500);
        });

        return { ok: true };
    },
    'UPDATE': async (request) => {
        if (!request.params.id) throw new WebError('No media id provided', 400);

        const data = request.getData();
        if (typeof data !== 'object' || data === null)
            throw new WebError('Request body must be an object', 400);
        const newName = (data as { name?: unknown }).name;
        if (typeof newName !== 'string') throw new WebError('Missing "name"', 400);

        try {
            validateFilename(newName);
        } catch (e) {
            throw new WebError((e as Error).message, 400);
        }

        const { mediaPath } = resolveDoc(request.params.id);
        const dir = path.dirname(mediaPath);
        const ext = path.extname(mediaPath);
        const target = resolveSafePath(scannerConfig.paths.media, path.join(path.relative(scannerConfig.paths.media, dir), `${newName}${ext}`));

        if (target === mediaPath) return { ok: true };

        await fs.access(target).then(
            () => { throw new WebError('A file with that name already exists', 409); },
            () => undefined,
        );

        await fs.rename(mediaPath, target).catch(err => {
            throw new WebError(`Failed to rename: ${err.message}`, 500);
        });

        return { ok: true };
    },
};
