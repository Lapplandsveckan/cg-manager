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

        return plugin['_enabled'];
    },
    'POST': async (request) => {
        if (!request.params.id) throw new WebError('No plugin id provided', 400);
        if (typeof request.body.enabled !== 'boolean') throw new WebError('Invalid enabled value', 400);

        const plugin = CasparManager
            .getManager()
            .getPlugins()
            .plugins
            .find((plugin) => plugin.pluginName === request.params.id);

        if (request.body.enabled) plugin['enable']();
        else plugin['disable']();

        return plugin['_enabled'];
    },
};