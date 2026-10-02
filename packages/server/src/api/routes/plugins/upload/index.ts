import { type RouteExport } from '../../../route';
import { parseBody } from '../../../validate';
import { Upload } from '../../../../manager/scanner/upload';
import { pluginUploadBody } from '../../../../schemas/plugins';

export default {
    ACTION: async request => {
        const { filename, chunks } = parseBody(pluginUploadBody, request);

        const safeName = filename.replace(/[^A-Za-z0-9._-]/g, '_');
        const upload = await Upload.create('plugin', safeName, chunks);
        return { id: upload.id };
    },
} satisfies RouteExport;
