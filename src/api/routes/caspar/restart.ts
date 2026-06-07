import { type RouteExport } from '../../route';
import { CasparManager } from '../../../manager';

export default {
    ACTION: () => CasparManager.getManager().getCasparProcess().restart(),
} satisfies RouteExport;
