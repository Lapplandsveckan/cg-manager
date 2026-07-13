import { type RouteExport } from '../route';
import { version } from '../../util/version';

export default {
    GET: async () => version,
} satisfies RouteExport;
