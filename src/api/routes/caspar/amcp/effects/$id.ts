import {CasparManager} from '../../../../../manager';

export default {
    'GET': async (request) => {
        if (!request.params.id) return null;

        return CasparManager
            .getManager()
            .getExecutor()
            .getEffect(request.params.id)
           ?.toJSON();
    },
};