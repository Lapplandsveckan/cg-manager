import {CasparManager} from '../../../../manager';

export default {
    'GET': async (request) => {
        if (!request.params.id) return null;

        return CasparManager
            .getManager()
            .getPluginInjectionCode(request.params.id)
            .catch((e) => console.error(e));
    },
};