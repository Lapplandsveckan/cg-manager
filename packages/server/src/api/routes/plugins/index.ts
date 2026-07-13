import { type RouteExport } from '../../route';
import { CasparManager } from '../../../manager';

export default {
    GET: async () => CasparManager.getManager().getPlugins().list(),
} satisfies RouteExport;
