import {type RouteExport} from '../../route';
import {CasparManager} from '../../../manager';

export default {
    'GET': async () => CasparManager
        .getManager()
        .getPlugins()
        .plugins
        .map((plugin) => ({
            name: plugin.pluginName,
            enabled: plugin['_enabled'],
        })),
} satisfies RouteExport;
