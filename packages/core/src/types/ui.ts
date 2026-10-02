export const UI_INJECTION_ZONE = {
    PLUGIN_PAGE: 'plugin-page',

    /**
     * Top-level sidebar button + page, served at `/ext/:plugin[/:pageKey]`.
     * Use a dotted sub-zone (`navbar-page.<pageKey>`) for more than one
     * button per plugin. Label and icon come from a `meta = { label, icon }`
     * export on the page module (label falls back to the page key, then the
     * plugin name).
     */
    NAVBAR_PAGE: 'navbar-page',

    RUNDOWN_ITEM: 'rundown-item',
    RUNDOWN_EDITOR: 'rundown-editor',

    RUNDOWN_SIDE: 'rundown-side',
    RUNDOWN_BOTTOM_PANEL: 'rundown-bottom-panel',

    UPLOAD_OPTIONS: 'upload-options',

    /**
     * Not rendered visually. Mounted in a hidden div; components call
     * `useRegisterContextMenuItems(surface, provider)` to add right-click
     * items. Target a surface with a dotted sub-zone, e.g.
     * `context-menu.rundown-item`.
     */
    CONTEXT_MENU: 'context-menu',

    /** Mounted once at the app root for the plugin's whole enabled lifetime. */
    GLOBAL: 'global',
} as const;

export type UI_INJECTION_ZONE =
    (typeof UI_INJECTION_ZONE)[keyof typeof UI_INJECTION_ZONE];

/**
 * Plugins can also define their own zone for others to extend, as
 * `plugin:<owner-defined-name>` (e.g. `plugin:edgeblend.sidebar`).
 */
export type UI_INJECTION_ZONE_KEY =
    UI_INJECTION_ZONE | `${UI_INJECTION_ZONE}.${string}` | `plugin:${string}`;

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
