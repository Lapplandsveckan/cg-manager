import {type RouteExport} from '../../../../route';
import {CasparManager} from '../../../../../manager';

export default {
    'GET': async () => CasparManager
        .getManager()
        .getExecutor()
        .getEffects()
        .map(effect => effect.id),
} satisfies RouteExport;
