/**
 * Renders hidden injection zones for each context-menu surface. Components
 * injected into these zones mount here (invisibly) and call
 * `useRegisterContextMenuItems(surface, provider)` to contribute items to the
 * host's right-click menus.
 *
 * Mounting eagerly — inside ContextMenuProvider, at the top of the app — ensures
 * providers are registered before the user ever right-clicks.
 */
import React from 'react';
import { Injections, UI_INJECTION_ZONE } from '../lib/api/inject';
import type { ContextMenuSurface } from './ContextMenuProvider';

// Exhaustiveness check: if a surface is added to ContextMenuSurface but not
// here, TypeScript will error because Record<ContextMenuSurface, true> requires
// all keys to be present.
const SURFACES_MAP: Record<ContextMenuSurface, true> = {
    'rundown-item': true,
    media: true,
    route: true,
    plugin: true,
};
const SURFACES = Object.keys(SURFACES_MAP) as ContextMenuSurface[];

export const PluginContextMenuMounts: React.FC = () => (
    <div style={{ display: 'none' }} aria-hidden>
        {SURFACES.map(surface => (
            <Injections
                key={surface}
                zone={
                    `${UI_INJECTION_ZONE.CONTEXT_MENU}.${surface}` as typeof UI_INJECTION_ZONE.CONTEXT_MENU
                }
            />
        ))}
    </div>
);
