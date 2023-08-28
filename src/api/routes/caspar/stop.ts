import {CasparManager} from '../../../manager';

export default {
    'POST': async (request) => {
        await CasparManager
            .getManager()
            .getCasparProcess()
            .stop();
    },
};