import * as path from 'path';
import { WebError } from 'rest-exchange-protocol';
import { CasparManager } from '../index';
import scannerConfig from './config';
import { resolveSafePath } from './util';

export function resolveMediaFile(id: string) {
    const doc = CasparManager.getManager()
        .getMediaScanner()
        .getDatabase()
        .get(id);

    if (!doc) throw new WebError('Media not found', 404);
    if (!doc.mediaPath) throw new WebError('Media has no file on disk', 409);

    const mediaPath = resolveSafePath(
        scannerConfig.paths.media,
        path.relative(scannerConfig.paths.media, doc.mediaPath),
    );
    return { doc, mediaPath };
}
