import {WebError} from 'rest-exchange-protocol';
import {Upload} from '../../../../../manager/scanner/upload';

export default {
    'ACTION': async (request) => {
        const data = request.getData();
        if (typeof data !== 'object') throw new WebError('Invalid request data', 400);

        const { id } = data as { id: string };
        if (typeof id !== 'string') throw new WebError('Invalid id', 400);

        const upload = Upload.get(id);
        if (!upload) throw new WebError('Upload not found', 404);

        await upload.cancel();
        return {};
    },
};