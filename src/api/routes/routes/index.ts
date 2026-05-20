import {CasparManager} from '../../../manager';

export default {
    'GET': async () => {
        return CasparManager
            .getManager()
            .routes
            .getVideoRoutes();
    },
};
