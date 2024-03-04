import {CasparManager} from '../../../../manager';

export default {
    'GET': async (request) => {
        return CasparManager
            .getManager()
            .getMediaScanner()
            .getDatabase()
            .allDocs()
            .map(doc => doc.id);
    },
};