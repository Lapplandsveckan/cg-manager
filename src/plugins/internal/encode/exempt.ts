import {promises as fs} from 'fs';
import path from 'path';
import {noTryAsync} from 'no-try';
import scannerConfig from '../../../manager/scanner/config';

/** Marker filenames that opt a file (or anything under a directory)
 *  out of encoding. Two flavours:
 *    - `<file>.cgskip` next to a specific file
 *    - `.cgskip` in a directory, exempting that directory's tree */
export const EXEMPT_MARKER_NAME = '.cgskip';

/** Max depth to walk when looking for a directory marker. Caps I/O on
 *  pathologically nested trees or symlink loops. */
const EXEMPT_WALK_LIMIT = 8;

/**
 * True iff `filePath` is exempt from encoding — either because a
 * `<filePath>.cgnoencode` sidecar exists, or because one of its parent
 * directories (up to EXEMPT_WALK_LIMIT levels) contains a
 * `.cgnoencode` file.
 */
export async function isExempt(filePath: string): Promise<boolean> {
    // Per-file sidecar — the most discoverable form for one-off exemptions.
    {
        const [err] = await noTryAsync(() => fs.access(`${filePath}.${EXEMPT_MARKER_NAME.slice(1)}`));
        if (!err) return true;
    }

    // Walk parents looking for a directory-level marker.
    let dir = path.dirname(filePath);
    const root = path.parse(dir).root;
    for (let i = 0; i < EXEMPT_WALK_LIMIT && dir && dir !== root; i++) {
        const [err] = await noTryAsync(() => fs.access(path.join(dir, EXEMPT_MARKER_NAME)));
        if (!err) return true;
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    return false;
}

export interface SetExemptResult {
    ok: boolean;
    /** Resolved absolute path of the file the sidecar applies to, when
     *  the call succeeded. Useful for the caller to cancel a matching
     *  in-flight encode job. */
    target?: string;
    error?: string;
}

/**
 * Create / remove the `<file>.cgnoencode` sidecar for a media file
 * inside the CasparCG media root. `rel` is a path relative to that
 * root — absolute paths and `..` segments are rejected so the marker
 * can't land outside the operator-intended tree.
 *
 * Used by both the REST endpoint and any future code paths that want
 * to toggle exemption programmatically.
 */
export async function setExempt(rel: unknown, exempt: boolean): Promise<SetExemptResult> {
    if (typeof rel !== 'string' || rel.length === 0)
        return {ok: false, error: 'Invalid path'};
    if (path.isAbsolute(rel) || rel.split(/[\\/]/).includes('..'))
        return {ok: false, error: 'Invalid path'};

    // Resolve against the media root + double-check the result still
    // sits under it (defence-in-depth against path-traversal cases we
    // missed above).
    const mediaRoot = path.resolve(scannerConfig.paths.media);
    const target = path.resolve(mediaRoot, rel);
    if (target !== mediaRoot && !target.startsWith(mediaRoot + path.sep))
        return {ok: false, error: 'Path escapes media root'};

    const sidecar = `${target}.cgskip`;
    if (exempt) {
        // `wx` so a pre-existing sidecar isn't truncated (it might
        // have a comment from the operator). EEXIST = success: they
        // had already opted out.
        const [err] = await noTryAsync(() => fs.writeFile(sidecar, '', {flag: 'wx'}));
        if (err && (err as NodeJS.ErrnoException).code !== 'EEXIST')
            return {ok: false, error: err.message};
    } else {
        const [err] = await noTryAsync(() => fs.unlink(sidecar));
        if (err && (err as NodeJS.ErrnoException).code !== 'ENOENT')
            return {ok: false, error: err.message};
    }

    return {ok: true, target};
}
