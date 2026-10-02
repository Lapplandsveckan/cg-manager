import {
    type ComponentType,
    createElement,
    Fragment,
    useEffect,
    useState,
} from 'react';
import type React from 'react';
import { type REPClient } from 'rest-exchange-protocol-client';
import { useSocket } from '../hooks/useSocket';
import { SlotErrorBoundary } from '../../components/SlotErrorBoundary';
import {
    useInjectedComponents,
    useInjectionsForZone,
    usePluginInjectionsQuery,
} from '../query/pluginInjections';

export const UI_INJECTION_ZONE = {
    PLUGIN_PAGE: 'plugin-page',

    // One button per registration; use navbar-page.<pageKey> for more. Label/icon come from the page meta export
    NAVBAR_PAGE: 'navbar-page',

    RUNDOWN_ITEM: 'rundown-item',
    RUNDOWN_EDITOR: 'rundown-editor',

    RUNDOWN_SIDE: 'rundown-side',
    RUNDOWN_BOTTOM_PANEL: 'rundown-bottom-panel',

    // Media upload modal only; injections receive targetPaths: string[] props
    UPLOAD_OPTIONS: 'upload-options',

    // Hidden mount; components call useRegisterContextMenuItems
    CONTEXT_MENU: 'context-menu',

    GLOBAL: 'global',
} as const;

export type UI_INJECTION_ZONE =
    (typeof UI_INJECTION_ZONE)[keyof typeof UI_INJECTION_ZONE];
// Keep in sync with @lappis/cg-manager types/ui.ts and manager/plugins/ui.ts
export type UI_INJECTION_ZONE_KEY =
    UI_INJECTION_ZONE | `${UI_INJECTION_ZONE}.${string}` | `plugin:${string}`;

export interface Injection {
    zone: UI_INJECTION_ZONE_KEY;
    file: string;
    plugin: string;
    id: string;
}

interface PluginModule {
    default?: React.ComponentType;
    meta?: { label?: string; icon?: string };
}

export class PluginInjectionAPI {
    private _modules = new Map<string, PluginModule | Promise<PluginModule>>();
    private socket: REPClient;

    constructor(socket: REPClient) {
        this.socket = socket;
    }

    public async list(): Promise<Injection[]> {
        const res = await this.socket.request('api/plugins/inject', 'GET', {});
        return res as Injection[];
    }

    private async _importModule(id: string) {
        const data = await this.socket.request(
            `api/plugins/inject/${id}`,
            'GET',
            {},
        );
        const str = data as string;

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

    private async moduleOf(id: string): Promise<PluginModule> {
        const cached = this._modules.get(id);
        if (cached) return cached;

        const promise = this._importModule(id);
        this._modules.set(id, promise);

        const module = await promise;
        this._modules.set(id, module);

        return module;
    }

    public async import(id: string): Promise<React.ComponentType> {
        const module = await this.moduleOf(id);
        return module?.default as React.ComponentType;
    }

    public async meta(id: string) {
        const module = await this.moduleOf(id);
        return module?.meta ?? null;
    }
}

interface InjectionProps {
    id: string;
    props?: Record<string, unknown>;
}

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
    props?: Record<string, unknown>;
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
