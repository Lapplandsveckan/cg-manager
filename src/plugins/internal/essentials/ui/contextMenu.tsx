/**
 * Example context-menu provider for the essentials plugin.
 *
 * This component renders nothing visible. On mount it registers a provider
 * for the 'rundown-item' surface via `useRegisterContextMenuItems`. The host
 * calls the provider whenever a rundown entry is right-clicked, appending the
 * returned items after the built-in host items.
 *
 * To adapt this for other surfaces, change the first argument to one of:
 *   'media' | 'route' | 'plugin'
 * and update the target type cast accordingly.
 */
import { useRegisterContextMenuItems } from '@web-lib';
import type { ContextMenuRundownItemTarget } from '@web-lib';

// This component renders nothing visible — it only registers a context-menu
// provider on mount via the `useRegisterContextMenuItems` hook.
export default function RundownItemProvider() {
    useRegisterContextMenuItems<ContextMenuRundownItemTarget>(
        'rundown-item',
        target => [
            target.type === 'toggle-video-route' && {
                label: 'Inspect route',
                // eslint-disable-next-line no-console
                onClick: () =>
                    console.log('[essentials] Inspect route item:', target),
            },
        ],
    );

    return null;
}
