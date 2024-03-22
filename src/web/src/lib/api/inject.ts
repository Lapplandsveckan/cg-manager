import {REPClient} from 'rest-exchange-protocol-client';
import {useSocket} from '../hooks/useSocket';
import React, {ComponentType, createElement, Fragment, useEffect, useState} from 'react';
import * as material from '@mui/material';
import * as weblib from '../';

if (typeof window !== 'undefined') {
    window['React'] = React;
    window['MaterialUI'] = material;
    window['WebLib'] = weblib;
}

export const UI_INJECTION_ZONE = {
    PLUGIN_PAGE: 'plugin-page',
} as const;

export type UI_INJECTION_ZONE = typeof UI_INJECTION_ZONE[keyof typeof UI_INJECTION_ZONE];

export interface Injection {
    zone: UI_INJECTION_ZONE;
    file: string;
    plugin: string;
    id: string;
}

export class PluginInjectionAPI {
    private _loaded = new Map<string, React.ComponentType | Promise<React.ComponentType>>();
    private _plugins = new Map<string, Injection>();
    private _pluginPromise: Promise<Map<string, Injection>>;
    private socket: REPClient;

    constructor(socket: REPClient) {
        this.socket = socket;

        this._pluginPromise = this.requestPlugins();
        this._pluginPromise
            .then(() => this._pluginPromise = null)
            .catch(e => console.error('Failed to get plugins', e));
    }

    private async requestPlugins() {
        const res = await this.socket.request('api/plugins/inject', 'GET', {});
        this._plugins.clear();

        const plugins = res.data as Injection[];
        for (const plugin of plugins) this._plugins.set(plugin.id, plugin);

        return this._plugins;
    }

    private async _import(id: string) {
        const data = await this.socket.request(`api/plugins/inject/${id}`, 'GET', {});
        const str = data.data as string;

        if (typeof URL.createObjectURL !== 'undefined') {
            const blob = new Blob([str], { type: 'text/javascript' });
            const url = URL.createObjectURL(blob);
            const component = import(/* webpackIgnore: true */url).then(module => module.default);
            URL.revokeObjectURL(url);

            return component;
        }

        const url = `data:text/javascript;base64,${btoa(str)}`;
        return import(/* webpackIgnore: true */url).then(module => module.default);
    }

    public async import(id: string): Promise<React.ComponentType> {
        if (this._loaded.has(id)) return this._loaded.get(id);

        const promise = this._import(id);
        this._loaded.set(id, promise);

        const component = await promise;
        this._loaded.set(id, component);

        return component;
    }

    public async getInjects(zone: UI_INJECTION_ZONE, plugin: string | null = null): Promise<Injection[]> {
        await this._pluginPromise;
        return Array.from(this._plugins.values()).filter(p => p.zone === zone && (!plugin || p.plugin === plugin));
    }

    public async inject(zone: UI_INJECTION_ZONE, plugin: string | null = null) {
        const injects = await this.getInjects(zone, plugin);
        return await Promise.all(
            injects.map(i =>
                this.import(i.id)
                    .then(component => ({id: i.id, component})),
            ),
        );
    }
}

export const Injections: React.FC<{zone: UI_INJECTION_ZONE, plugin?: string | null}> = ({zone, plugin}) => {
    const [components, setComponents] = useState<{id: string, component: ComponentType}[]>([]);
    const socket = useSocket();

    useEffect(() => {
        let mounted = true;
        socket.injects.inject(zone, plugin)
            .then(components => mounted && setComponents(components));

        return () => void (mounted = false);
    }, [zone, plugin]);

    return createElement(
        Fragment,
        null,
        components.map((inject) =>
            inject.component ? createElement(inject.component, {key: inject.id}) : null,
        ),
    );
};