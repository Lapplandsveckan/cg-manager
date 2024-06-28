import {CasparManager} from '../../../manager';
import {WebError} from 'rest-exchange-protocol';

export default {
    'CREATE': async (request) => {
        const data = request.getData();
        if (typeof data !== 'string') throw new WebError('Invalid request data', 400);

        const manager = CasparManager
            .getManager();

        const rundown = manager
            .rundowns
            .createRundown(data, 'quick');

        manager
            .server
            .broadcast('rundown', 'CREATE', rundown, request.getClient());

        return rundown;
    },
    'GET': async (request) => {
        return CasparManager
            .getManager()
            .rundowns
            .getQuickActions();
    }
};