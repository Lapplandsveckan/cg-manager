import {CasparManager} from '../../../manager';

export default {
    'GET': async (request) => {
        return CasparManager
            .getManager()
            .getPlugins()
            .plugins
            .map((plugin) => ({
                name: plugin.pluginName,
                enabled: plugin['_enabled'],
            }));
    },
};