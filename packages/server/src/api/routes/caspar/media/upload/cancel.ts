import { WebError } from 'rest-exchange-protocol';
import { type RouteExport } from '../../../../route';
import { parseBody } from '../../../../validate';
import { Upload } from '../../../../../manager/scanner/upload';
import { uploadCancelBody } from '../../../../../schemas/media';

export default {
    ACTION: async request => {
        const { id } = parseBody(uploadCancelBody, request);

        const upload = Upload.get(id);
        if (!upload) throw new WebError('Upload not found', 404);

        await upload.cancel();
        return {};
    },
} satisfies RouteExport;
