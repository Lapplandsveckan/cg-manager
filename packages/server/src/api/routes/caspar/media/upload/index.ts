import { type RouteExport } from '../../../../route';
import { parseBody } from '../../../../validate';
import { Upload } from '../../../../../manager/scanner/upload';
import { DirectoryManager } from '../../../../../manager/scanner/dir';
import { safeMediaPath } from '../../../../../manager/scanner/util';
import { uploadBody } from '../../../../../schemas/media';

export default {
    ACTION: async request => {
        const { path, chunks } = parseBody(uploadBody, request);

        const resolved = await safeMediaPath(
            path,
            DirectoryManager.getManager()['mediaPath'],
        );

        const upload = await Upload.create('media', resolved, chunks);
        return {
            id: upload.id,
            path: resolved,
        };
    },
} satisfies RouteExport;
