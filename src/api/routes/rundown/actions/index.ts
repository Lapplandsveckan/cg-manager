import {CasparManager} from '../../../../manager';

export default {
    'GET': async () => {
        return CasparManager
            .getManager()
            .rundowns.executor
            .getActionDescriptors();
    },
};
