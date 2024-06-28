import {CasparManager} from '../../../manager';
import {WebError} from 'rest-exchange-protocol';

export default {
    'ACTION': async (request) => {
        const data = request.getData();
        if (typeof data !== 'object') throw new WebError('Invalid request data', 400);

        await CasparManager
            .getManager()
            .rundowns.executor
            .executeItem(data.entry);
    },
};