import {REPClient} from 'rest-exchange-protocol-client';
import EventEmitter from 'events';
import {getChunkCount} from './upload';

/**
 * All API calls relevant to CasparCG are handled here.
 */

interface Plugin {
    name: string;
    enabled: boolean;
}

export class PluginApi extends EventEmitter {
    private socket: REPClient;
    private plugins = [] as Plugin[];

    private logs: string = '';
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
}