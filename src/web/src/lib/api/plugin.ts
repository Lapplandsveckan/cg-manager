import EventEmitter from 'events';
import { type REPClient } from 'rest-exchange-protocol-client';
import { getChunkCount } from './upload';

export interface Plugin {
    name: string;
    enabled: boolean;
    builtin?: boolean;
}

export class PluginApi extends EventEmitter {
    private socket: REPClient;
    private plugins = [] as Plugin[];

    constructor(socket: REPClient) {
        super();
        this.socket = socket;

        // Listen for server-pushed plugin list updates (install / uninstall /
        // enable / disable). Replace the local cache and notify listeners.
        socket.routes.register({
            path: 'plugins',
            method: 'ACTION',
            handler: request => {
                const list = request.getData() as Plugin[];
                if (Array.isArray(list)) {
                    this.plugins = list;
                    this.emit('change', list);
                }
            },
        });
    }

    public async getPlugins(): Promise<Plugin[]> {
        const res = await this.socket.request('api/plugins', 'GET', {});
        this.plugins = res.data as Plugin[];
        return this.plugins;
    }

    /** Force a fresh fetch and update the local cache. */
    public async refresh(): Promise<Plugin[]> {
        return this.getPlugins();
    }

    public async setEnabled(name: string, enabled: boolean): Promise<boolean> {
        const res = await this.socket.request(
            `api/plugins/${encodeURIComponent(name)}/status`,
            'ACTION',
            { enabled },
        );
        if (typeof res.data !== 'boolean')
            throw new Error(
                `Plugin toggle returned unexpected value: ${JSON.stringify(res.data)}`,
            );
        return res.data;
    }

    /** Create a plugin upload session and return the upload id.
     *  Pass the file directly; chunk count is computed here. */
    public async uploadPlugin(file: File): Promise<string> {
        const chunks = getChunkCount(file);
        const res = await this.socket.request(
            'api/plugins/upload',
            'ACTION',
            { filename: file.name, chunks },
        );
        return (res.data as { id: string }).id;
    }

    public async uninstall(name: string) {
        await this.socket.request(
            `api/plugins/${encodeURIComponent(name)}`,
            'DELETE',
            {},
        );
    }
}
