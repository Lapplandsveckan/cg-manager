import { useTranslation } from 'react-i18next';
import {
    useRegisterContextMenuItems,
    type ContextMenuRundownItemTarget,
} from '@web-lib';
import { openRouteInspector } from './inspectorEvents';

function routeIdOf(data: unknown): string | undefined {
    if (typeof data !== 'object' || data === null) return undefined;
    const { routeId } = data as { routeId?: unknown };
    return typeof routeId === 'string' ? routeId : undefined;
}

export default function RundownItemProvider() {
    const { t } = useTranslation('routes');

    useRegisterContextMenuItems<ContextMenuRundownItemTarget>(
        'rundown-item',
        target => {
            const routeId = routeIdOf(target.data);
            return [
                target.type === 'toggle-video-route' && {
                    label: t('inspectRoute.menuLabel'),
                    disabled: !routeId,
                    onClick: () =>
                        routeId && openRouteInspector({ edit: routeId }),
                },
            ];
        },
    );

    return null;
}
