import { WebError } from 'rest-exchange-protocol';
import { type RouteExport } from '../../../route';
import { Upload } from '../../../../manager/scanner/upload';

export default {
    ACTION: async request => {
        const data = request.getData();
        if (!data || typeof data !== 'object')
            throw new WebError('Invalid request data', 400);

        const { filename, chunks } = data as {
            filename: string;
            chunks: number;
        };
        if (typeof filename !== 'string')
            throw new WebError('Invalid filename', 400);
        if (!Number.isInteger(chunks) || chunks < 1)
            throw new WebError('Invalid chunks', 400);

        // Strip any path components — the filename is only used for the temp
        // staging file; extraction picks the real folder name from package.json.
        const safeName = filename.replace(/[^A-Za-z0-9._-]/g, '_');
        const upload = await Upload.create('plugin', safeName, chunks);
        return { id: upload.id };
    },
} satisfies RouteExport;
