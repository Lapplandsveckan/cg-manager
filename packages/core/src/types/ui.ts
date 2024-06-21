export const UI_INJECTION_ZONE = {
    EFFECT_CREATOR: 'effect-creator',
    PLUGIN_PAGE: 'plugin-page',
} as const;

export type UI_INJECTION_ZONE = typeof UI_INJECTION_ZONE[keyof typeof UI_INJECTION_ZONE];

export interface Injection {
    zone: UI_INJECTION_ZONE;
    file: string;
    plugin: string;
    id: string;
}
export declare class UIInjector {
    public register(zone: UI_INJECTION_ZONE, file: string, plugin: string): string;
    public unregister(id: string): void;

    public getInjections(zone?: UI_INJECTION_ZONE): Injection[];
    public bundle(id: string): Promise<string | null>;
}