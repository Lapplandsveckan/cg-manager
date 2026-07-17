import { WebError } from 'rest-exchange-protocol';
import { noTryAsync } from 'no-try';
import { type RouteExport } from '../../../../route';
import { CasparManager } from '../../../../../manager';

export default {
    DELETE: async request => {
        if (!request.params.id || !request.params.version)
            throw new WebError('No plugin id or version provided', 400);

        const plugins = CasparManager.getManager().getPlugins();
        if (plugins.isBuiltin(request.params.id))
            throw new WebError(
                'Built-in plugins do not have selectable versions',
                400,
            );

        const folderName = plugins.getFolderName(request.params.id);
        if (!folderName) throw new WebError('Plugin not found', 404);

        const [err] = await noTryAsync(() =>
            plugins.versions.removeVersion(folderName, request.params.version),
        );
        if (err)
            throw new WebError(err.message ?? 'Failed to remove version', 404);

        return null;
    },
} satisfies RouteExport;
