import { type RouteExport } from '../../route';
import {
    getCapabilities,
    getProfileName,
} from '../../../manager/caspar/config/profiles';

export default {
    GET: async () => ({
        profile: getProfileName(),
        capabilities: getCapabilities(),
    }),
} satisfies RouteExport;
