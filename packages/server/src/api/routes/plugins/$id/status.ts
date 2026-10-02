import { WebError } from 'rest-exchange-protocol';
import { type RouteExport } from '../../../route';
import { parseBody } from '../../../validate';
import { statusBody } from '../../../../schemas/plugins';
import { CasparManager } from '../../../../manager';
import { Logger } from '../../../../util/log';

export default {
    GET: async request => {
        if (!request.params.id)
            throw new WebError('No plugin id provided', 400);

        const plugin = CasparManager.getManager()
            .getPlugins()
            .plugins.find(plugin => plugin.pluginName === request.params.id);

        if (!plugin) throw new WebError('Plugin not found', 404);

        return plugin['_enabled'];
    },
    ACTION: async request => {
        if (!request.params.id)
            throw new WebError('No plugin id provided', 400);

        const { enabled } = parseBody(statusBody, request);

        const plugins = CasparManager.getManager().getPlugins();
        const plugin = plugins.plugins.find(
            plugin => plugin.pluginName === request.params.id,
        );

        if (!plugin) throw new WebError('Plugin not found', 404);

        const logger = Logger.scope('Plugin Loader').scope(plugin.pluginName);
        if (enabled) plugins.enablePlugin(plugin, logger);
        else plugins.disablePlugin(plugin, logger);

        return plugin['_enabled'];
    },
} satisfies RouteExport;
