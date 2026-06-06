import {WebError} from 'rest-exchange-protocol';
import {type RouteExport} from '../../../../route';
import {Upload} from '../../../../../manager/scanner/upload';
import {DirectoryManager} from '../../../../../manager/scanner/dir';
import {safeMediaPath} from '../../../../../manager/scanner/util';

export default {
    'ACTION': async (request) => {
        const data = request.getData();
        if (typeof data !== 'object') throw new WebError('Invalid request data', 400);

        const { path, chunks } = data as { path: string, chunks: number };
        if (typeof path !== 'string') throw new WebError('Invalid path', 400);
        if (typeof chunks !== 'number') throw new WebError('Invalid chunks', 400);

        // Resolve to an ASCII-safe, non-colliding path before opening the
        // upload. Upload.create's defensive sanitize then becomes a no-op
        // since the path is already normalized.
        const resolved = await safeMediaPath(path, DirectoryManager.getManager()['mediaPath']);

        const upload = await Upload.create('media', resolved, chunks);
        return {
            id: upload.id,
            path: resolved,
        };
    },
} satisfies RouteExport;
