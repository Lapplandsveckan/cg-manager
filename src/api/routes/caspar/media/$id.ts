import {CasparManager} from '../../../../manager';

export default {
    'GET': async (request) => {
        if (!request.params.id) return null;

        return CasparManager
            .getManager()
            .getMediaScanner()
            .getDatabase()
            .get(request.params.id);
    },
};