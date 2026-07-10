import { WebError } from 'rest-exchange-protocol';
import { noTryAsync } from 'no-try';
import { type RouteExport } from '../../../route';
import { CasparManager } from '../../../../manager';

export default {
    ACTION: async request => {
        if (!request.params.id)
            throw new WebError('No plugin id provided', 400);

        const data = request.getData();
        if (
            typeof data !== 'object' ||
            typeof (data as any).version !== 'string'
        )
            throw new WebError('Invalid version value', 400);

        const plugins = CasparManager.getManager().getPlugins();
        if (plugins.isBuiltin(request.params.id))
            throw new WebError(
                'Built-in plugins do not have selectable versions',
                400,
            );

        const folderName = plugins.getFolderName(request.params.id);
        if (!folderName) throw new WebError('Plugin not found', 404);

        const [err] = await noTryAsync(() =>
            plugins.setActiveVersion(folderName, (data as any).version),
        );
        if (err)
            throw new WebError(err.message ?? 'Failed to switch version', 404);

        return plugins.list().find(p => p.name === request.params.id) ?? null;
    },
} satisfies RouteExport;
