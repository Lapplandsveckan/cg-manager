import {
    type ComponentType,
    createElement,
    Fragment,
    useEffect,
    useState,
} from 'react';
import type React from 'react';
import { useSocket } from '../hooks/useSocket';
import { SlotErrorBoundary } from '../../components/SlotErrorBoundary';
import {
    useInjectedComponents,
    useInjectionsForZone,
    usePluginInjectionsQuery,
} from '../query/pluginInjections';
import { type CheckedRepClient } from './repClient';

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

    // Rendered inside the **media** upload modal while a file is being
    // uploaded; injections receive `targetPaths: string[]` (server-side
    // absolute paths) via props so they can act on the in-flight files.
    // The plugin-install modal deliberately passes `optionsZone={null}`
    // to suppress this zone — media-specific options make no sense there.
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
// form `plugin:<owner-defined-name>` — mirrors @lappis/cg-manager's
// types/ui.ts and the server's manager/plugins/ui.ts, keep all in sync.
export type UI_INJECTION_ZONE_KEY =
    UI_INJECTION_ZONE | `${UI_INJECTION_ZONE}.${string}` | `plugin:${string}`;

export interface Injection {
    zone: UI_INJECTION_ZONE_KEY;
    file: string;
    plugin: string;
    id: string;
}

export class PluginInjectionAPI {
    private _modules = new Map<string, any | Promise<any>>();
    private socket: CheckedRepClient;

    constructor(socket: CheckedRepClient) {
        this.socket = socket;
    }

    public async list(): Promise<Injection[]> {
        const res = await this.socket.request('api/plugins/inject', 'GET', {});
        return res.data as Injection[];
    }

    private async _importModule(id: string) {
        const data = await this.socket.request(
            `api/plugins/inject/${id}`,
            'GET',
            {},
        );
        const str = data.data as string;

        if (typeof URL.createObjectURL !== 'undefined') {
            const blob = new Blob([str], { type: 'text/javascript' });
            const url = URL.createObjectURL(blob);
            const module = await import(/* webpackIgnore: true */ url);
            URL.revokeObjectURL(url);

            return module;
        }

        const url = `data:text/javascript;base64,${btoa(str)}`;
        return import(/* webpackIgnore: true */ url);
    }

    // Loads (and caches) the full ES module namespace for an injection, so
    // both its default export (the component) and named exports (e.g. a
    // navbar page's `meta`) are reachable from one bundle fetch.
    private async moduleOf(id: string): Promise<any> {
        if (this._modules.has(id)) return this._modules.get(id);

        const promise = this._importModule(id);
        this._modules.set(id, promise);

        const module = await promise;
        this._modules.set(id, module);

        return module;
    }

    public async import(id: string): Promise<React.ComponentType> {
        const module = await this.moduleOf(id);
        return module?.default;
    }

    // Named `meta` export of a navbar-page (or similar) injection module —
    // e.g. `{ label, icon }`. Returns null if the module has none.
    public async meta(id: string): Promise<any> {
        const module = await this.moduleOf(id);
        return module?.meta ?? null;
    }
}

interface InjectionProps {
    id: string;
    props?: any;
}

// Renders a single injection by id. Use this when you need one specific
// injection rather than all injections in a zone.
export const Injection: React.FC<InjectionProps> = ({ id, props }) => {
    const [Component, setComponent] = useState<ComponentType | null>(null);
    const socket = useSocket();

    useEffect(() => {
        let mounted = true;
        socket.injects.import(id).then(c => mounted && setComponent(() => c));
        return () => {
            mounted = false;
        };
    }, [id, socket]);

    return Component
        ? createElement(
              SlotErrorBoundary,
              { label: `plugin:${id}`, resetKeys: [id] },
              createElement(Component, props ?? null),
          )
        : null;
};

interface InjectionsProps {
    zone: UI_INJECTION_ZONE_KEY;
    plugin?: string | null;
    props?: any;
    fallback?: React.ReactNode;
}

export const Injections: React.FC<InjectionsProps> = ({
    zone,
    plugin,
    props,
    fallback,
}) => {
    const { isPending: injectionsPending } = usePluginInjectionsQuery();
    const injections = useInjectionsForZone(zone, plugin ?? null);
    const { components, loaded } = useInjectedComponents(
        injections,
        injectionsPending,
    );

    if (loaded && components.length === 0 && fallback) {
        return createElement(
            SlotErrorBoundary,
            { label: `default:${zone}`, resetKeys: [zone] },
            fallback,
        );
    }

    return createElement(
        Fragment,
        null,
        components.map(inject =>
            inject.component
                ? createElement(
                      SlotErrorBoundary,
                      {
                          key: inject.id,
                          label: `plugin:${inject.id}`,
                          resetKeys: [inject.id],
                      },
                      createElement(inject.component, props ?? null),
                  )
                : null,
        ),
    );
};
