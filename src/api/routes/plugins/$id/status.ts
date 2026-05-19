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

        return plugin['_enabled'];
    },
    'POST': async (request) => {
        if (!request.params.id) throw new WebError('No plugin id provided', 400);

        const data = request.getData();
        if (typeof data !== 'object' || typeof (data as any).enabled !== 'boolean')
            throw new WebError('Invalid enabled value', 400);

        const plugin = CasparManager
            .getManager()
            .getPlugins()
            .plugins
            .find((plugin) => plugin.pluginName === request.params.id);

        if (!plugin) throw new WebError('Plugin not found', 404);

        if ((data as any).enabled) plugin['enable']();
        else plugin['disable']();

        return plugin['_enabled'];
    },
};