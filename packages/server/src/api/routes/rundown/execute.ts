import { WebError } from 'rest-exchange-protocol';
import { type RouteExport } from '../../route';
import { CasparManager } from '../../../manager';
import { type RundownItem } from '../../../manager/rundown/rundown';

export default {
    ACTION: async request => {
        const data = request.getData();
        if (typeof data !== 'object')
            throw new WebError('Invalid request data', 400);

        await CasparManager.getManager().rundowns.executor.executeItem(
            (data as { entry: RundownItem }).entry,
        );
    },
} satisfies RouteExport;
