import { useTranslation } from 'react-i18next';
import { useRegisterContextMenuItems, useRouteInspector } from '@web-lib';
import type { ContextMenuRundownItemTarget } from '@web-lib';

function routeIdOf(data: unknown): string | undefined {
    if (typeof data !== 'object' || data === null) return undefined;
    const { routeId } = data as { routeId?: unknown };
    return typeof routeId === 'string' ? routeId : undefined;
}

// This component renders nothing visible — it only registers a context-menu
// provider on mount via the `useRegisterContextMenuItems` hook.
export default function RundownItemProvider() {
    const { t } = useTranslation();
    const { openRouteInspector } = useRouteInspector();

    useRegisterContextMenuItems<ContextMenuRundownItemTarget>(
        'rundown-item',
        target => {
            const routeId = routeIdOf(target.data);
            return [
                target.type === 'toggle-video-route' && {
                    label: t('plugins.essentials.inspectRoute.menuLabel'),
                    disabled: !routeId,
                    onClick: () => routeId && openRouteInspector(routeId),
                },
            ];
        },
    );

    return null;
}
