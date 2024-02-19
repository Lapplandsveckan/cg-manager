import {WebError} from 'rest-exchange-protocol';
import {Upload} from '../../../../../manager/scanner/upload';

export default {
    'ACTION': async (request) => {
        const data = request.getData();
        if (typeof data !== 'object') throw new WebError('Invalid request data', 400);

        const { path, chunks } = data as { path: string, chunks: number };
        if (typeof path !== 'string') throw new WebError('Invalid path', 400);
        if (typeof chunks !== 'number') throw new WebError('Invalid chunks', 400);

        const upload = await Upload.create('media', path, chunks);
        return {
            id: upload.id,
        };
    },
};