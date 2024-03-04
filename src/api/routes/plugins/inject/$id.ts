import {CasparManager} from '../../../../manager';
import {WebError} from 'rest-exchange-protocol';

export default {
    'GET': async (request) => {
        if (!request.params.id) throw new WebError('No plugin id provided', 400);

        return CasparManager
            .getManager()
            .getPluginInjectionCode(request.params.id)
            .catch((e) => console.error(e));
    },
};