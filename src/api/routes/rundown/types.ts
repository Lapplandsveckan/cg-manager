import {CasparManager} from '../../../manager';

export default {
    'GET': async (request) => {
        return CasparManager
            .getManager()
            .rundowns.executor
            .getActionTypes();
    },
};