import { WebError } from 'rest-exchange-protocol';
import { type RouteExport } from '../../../route';
import { CasparManager } from '../../../../manager';
import { Logger } from '../../../../util/log';

export default {
    GET: async request => {
        if (!request.params.id)
            throw new WebError('No plugin id provided', 400);

        const id = request.params.id;
        return CasparManager.getManager()
            .getPluginInjectionCode(id)
            .catch(e => {
                const logger = Logger.scope('Plugin Inject').scope(id);
                if (e instanceof Error) logger.error(e);
                else if (Array.isArray(e))
                    logger.error(
                        `Bundling failed:\n${e.map(x => x?.message ?? String(x)).join('\n')}`,
                    );
                else logger.error(`Bundling failed: ${String(e)}`);
                throw new WebError('Failed to bundle plugin UI', 500);
            });
    },
} satisfies RouteExport;
