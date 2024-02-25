import {CasparManager} from '../../../../../manager';
import {WebError} from 'rest-exchange-protocol';

export default {
    'GET': async (request) => {
        if (!request.params.id) throw new WebError('No effect id provided', 400);

        return CasparManager
            .getManager()
            .getExecutor()
            .getEffect(request.params.id)
            ?.toJSON();
    },
};