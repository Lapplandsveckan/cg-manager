export const UI_INJECTION_ZONE = {
    PLUGIN_PAGE: 'plugin-page',

    // Contributes a top-level sidebar button + page (served at
    // /ext/:plugin[/:pageKey]). One registration = one button. Use a dotted
    // sub-zone (`navbar-page.<pageKey>`) to add more than one button per
    // plugin; a bare registration is the single-button case. The label/icon
    // are read from a `meta = { label, icon }` export on the page module
    // (label falls back to the page-key, then the plugin name; icon falls
    // back to a default).
    NAVBAR_PAGE: 'navbar-page',

    RUNDOWN_ITEM: 'rundown-item',
    RUNDOWN_EDITOR: 'rundown-editor',

    RUNDOWN_SIDE: 'rundown-side',
    RUNDOWN_BOTTOM_PANEL: 'rundown-bottom-panel',

    UPLOAD_OPTIONS: 'upload-options',

    // Not rendered visually. Components injected here mount in a hidden div
    // and call `useRegisterContextMenuItems(surface, provider)` to contribute
    // items to host right-click menus. Use dotted sub-zones to target a
    // specific surface, e.g. `context-menu.rundown-item`.
    CONTEXT_MENU: 'context-menu',
} as const;

export type UI_INJECTION_ZONE =
    (typeof UI_INJECTION_ZONE)[keyof typeof UI_INJECTION_ZONE];
// A plugin can also define its own zone for other plugins to extend, in the
// form `plugin:<owner-defined-name>` (e.g. `plugin:edgeblend.sidebar`) — the
// same rendering machinery works for host zones and plugin zones alike.
export type UI_INJECTION_ZONE_KEY =
    | UI_INJECTION_ZONE
    | `${UI_INJECTION_ZONE}.${string}`
    | `plugin:${string}`;

export interface Injection {
    zone: UI_INJECTION_ZONE_KEY;
    file: string;
    plugin: string;
    id: string;
}
export declare class UIInjector {
    public register(
        zone: UI_INJECTION_ZONE_KEY,
        file: string,
        plugin: string,
    ): string;
    public unregister(id: string): void;

    public getInjections(zone?: UI_INJECTION_ZONE_KEY): Injection[];
    public bundle(id: string): Promise<string | null>;

    public getInjectionZone(
        zone: UI_INJECTION_ZONE_KEY,
        key: string,
    ): UI_INJECTION_ZONE_KEY;
}
