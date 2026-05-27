import {CasparManager} from '../../../../manager';
import {WebError} from 'rest-exchange-protocol';
import {Logger} from '../../../../util/log';

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
    'ACTION': async (request) => {
        if (!request.params.id) throw new WebError('No plugin id provided', 400);

        const data = request.getData();
        if (typeof data !== 'object' || typeof (data as any).enabled !== 'boolean')
            throw new WebError('Invalid enabled value', 400);

        const plugins = CasparManager.getManager().getPlugins();
        const plugin = plugins.plugins.find((plugin) => plugin.pluginName === request.params.id);

        if (!plugin) throw new WebError('Plugin not found', 404);

        const logger = Logger.scope('Plugin Loader').scope(plugin.pluginName);
        if ((data as any).enabled) plugins.enablePlugin(plugin, logger);
        else plugins.disablePlugin(plugin, logger);

        return plugin['_enabled'];
    },
};