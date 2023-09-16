import {CasparManager} from '../../../manager';

export default {
    'ACTION': async (request) => {
        await CasparManager
            .getManager()
            .getCasparProcess()
            .restart();
    },
};