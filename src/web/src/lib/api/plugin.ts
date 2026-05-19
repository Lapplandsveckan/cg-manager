import {REPClient} from 'rest-exchange-protocol-client';
import EventEmitter from 'events';

/**
 * All API calls relevant to CasparCG are handled here.
 */

export interface Plugin {
    name: string;
    enabled: boolean;
}

export class PluginApi extends EventEmitter {
    private socket: REPClient;
    private plugins = [] as Plugin[];

    private _pluginPromise: Promise<Plugin[]>;

    constructor(socket: REPClient) {
        super();
        this.socket = socket;

        // TODO: add listener for plugin updates

        this._pluginPromise = this.requestPlugin();
        this._pluginPromise
            .then(() => this._pluginPromise = null)
            .catch(e => console.error('Failed to get plugins', e));
    }

    private async requestPlugin() {
        const res = await this.socket.request('api/plugins', 'GET', {});
        this.plugins = res.data as Plugin[];

        return this.plugins;
    }

    public async getPlugins() {
        if (this._pluginPromise) return this._pluginPromise;
        return this.requestPlugin();
    }

    public async setEnabled(name: string, enabled: boolean): Promise<boolean> {
        const res = await this.socket.request(`api/plugins/${encodeURIComponent(name)}/status`, 'ACTION', { enabled });
        if (typeof res.data !== 'boolean')
            throw new Error(`Plugin toggle returned unexpected value: ${JSON.stringify(res.data)}`);
        return res.data;
    }
}