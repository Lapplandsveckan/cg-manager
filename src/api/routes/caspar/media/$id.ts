import {CasparManager} from '../../../../manager';
import {WebError} from 'rest-exchange-protocol';

export default {
    'GET': async (request) => {
        if (!request.params.id) throw new WebError('No media id provided', 400);

        return CasparManager
            .getManager()
            .getMediaScanner()
            .getDatabase()
            .get(decodeURIComponent(request.params.id));
    },
};