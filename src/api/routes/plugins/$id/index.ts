import { WebError } from 'rest-exchange-protocol';
import { type RouteExport } from '../../../route';
import { CasparManager } from '../../../../manager';

export default {
    GET: async request => {
        if (!request.params.id)
            throw new WebError('No plugin id provided', 400);

        const plugin = CasparManager.getManager()
            .getPlugins()
            .plugins.find(plugin => plugin.pluginName === request.params.id);

        if (!plugin) throw new WebError('Plugin not found', 404);

        const entry = CasparManager.getManager()
            .getPlugins()
            .list()
            .find(p => p.name === plugin.pluginName);

        return (
            entry ?? {
                name: plugin.pluginName,
                enabled: plugin['_enabled'],
                builtin: CasparManager.getManager()
                    .getPlugins()
                    .isBuiltin(plugin.pluginName),
            }
        );
    },
    DELETE: async request => {
        if (!request.params.id)
            throw new WebError('No plugin id provided', 400);

        const manager = CasparManager.getManager();
        if (manager.getPlugins().isBuiltin(request.params.id))
            throw new WebError('Built-in plugins cannot be uninstalled', 403);

        await manager.getPlugins().uninstall(request.params.id);
        manager.emit('plugin-list-changed');
        return null;
    },
} satisfies RouteExport;
