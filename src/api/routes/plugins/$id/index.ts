import {CasparManager} from '../../../../manager';
import {WebError} from 'rest-exchange-protocol';

export default {
    'GET': async (request) => {
        if (!request.params.id) throw new WebError('No plugin id provided', 400);

        const plugin = CasparManager
            .getManager()
            .getPlugins()
            .plugins
            .find((plugin) => plugin.pluginName === request.params.id);

        if (!plugin) throw new WebError('Plugin not found', 404);

        return {
            name: plugin.pluginName,
            enabled: plugin['_enabled'],
        };
    },
};