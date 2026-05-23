import {WebError} from 'rest-exchange-protocol';
import {promises as fs} from 'fs';
import * as path from 'path';
import scannerConfig from '../../../../manager/scanner/config';
import {resolveSafePath, validateFilename} from '../../../../manager/scanner/util';
import {
    PLACEHOLDER_NAME,
    listAllFolders,
    normalizeFolderPath,
    removeEmptyFolder,
} from '../../../../manager/scanner/folders';
import {noTry, noTryAsync} from 'no-try';

/**
 * Folder operations under the CasparCG media root.
 *
 * The scanner is file-driven, so an "empty folder" is not a thing it
 * tracks. We give the UI a way to create + list + delete folders directly
 * so users can pre-organise media before uploading.
 *
 * Each managed folder contains a `.cgkeep` placeholder file. The scanner
 * skips this name so it never shows up as media, and it keeps the folder
 * alive even when no media lives inside it.
 */
function validatePath(folderPath: string): string[] {
    if (typeof folderPath !== 'string')
        throw new WebError('Missing "path"', 400);

    const [normErr, segments] = noTry(() => normalizeFolderPath(folderPath));
    if (normErr || !segments) throw new WebError(normErr?.message ?? 'Invalid path', 400);

    for (const segment of segments) {
        const [err] = noTry(() => validateFilename(segment));
        if (err) throw new WebError(`Invalid segment "${segment}": ${err.message}`, 400);
        if (segment === PLACEHOLDER_NAME) throw new WebError('Reserved folder name', 400);
    }

    return segments;
}

export default {
    GET: async () => {
        return {folders: await listAllFolders(scannerConfig.paths.media)};
    },

    CREATE: async (request) => {
        const data = request.getData();
        if (typeof data !== 'object' || data === null)
            throw new WebError('Request body must be an object', 400);

        const segments = validatePath((data as {path?: string}).path ?? '');

        const target = resolveSafePath(scannerConfig.paths.media, segments.join(path.sep));
        await fs.mkdir(target, {recursive: true});

        const placeholder = path.join(target, PLACEHOLDER_NAME);
        await noTryAsync(() => fs.writeFile(placeholder, '', {flag: 'a'}));

        return {ok: true, path: `${segments.map(s => s.toUpperCase()).join('/')}/`};
    },

    DELETE: async (request) => {
        const data = request.getData();
        if (typeof data !== 'object' || data === null)
            throw new WebError('Request body must be an object', 400);

        const segments = validatePath((data as {path?: string}).path ?? '');

        const target = resolveSafePath(scannerConfig.paths.media, segments.join(path.sep));

        const [err] = await noTryAsync(() => removeEmptyFolder(target));
        if (err) {
            const code = (err as NodeJS.ErrnoException).code;
            if (code === 'ENOENT') throw new WebError('Folder does not exist', 404);
            if (/not empty/i.test(err.message)) throw new WebError(err.message, 409);
            throw new WebError(`Failed to delete: ${err.message}`, 500);
        }

        return {ok: true};
    },
};
