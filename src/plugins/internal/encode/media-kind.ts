import path from 'path';

/** Video containers we re-encode through the H.264/AAC pipeline. */
const VIDEO_EXTENSIONS = new Set([
    '.mp4',
    '.mov',
    '.mkv',
    '.mxf',
    '.m4v',
    '.webm',
    '.avi',
    '.wmv',
    '.mpg',
    '.mpeg',
    '.ts',
    '.m2ts',
]);

/** Still-image formats we normalise (resize + 16:9 letterbox/pillarbox). */
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

export type MediaKind = 'video' | 'image';

/** Map a filename to one of our two media pipelines, or `null` to skip
 *  the file entirely (templates, sidecars, READMEs, etc.). */
export function kindFor(filePath: string): MediaKind | null {
    const ext = path.extname(filePath).toLowerCase();
    if (VIDEO_EXTENSIONS.has(ext)) return 'video';
    if (IMAGE_EXTENSIONS.has(ext)) return 'image';
    return null;
}
