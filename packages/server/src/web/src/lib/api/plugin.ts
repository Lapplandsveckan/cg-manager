import EventEmitter from 'events';
import { type ManagerApi } from './api';
import { getChunkCount } from './upload';

export interface Plugin {
    name: string;
    enabled: boolean;
    builtin?: boolean;
    minChannels: number;
    dependencies?: string[];
    /** Present while disabled solely because of an unmet gate. */
    blockedReason?: 'channels' | 'dependency';
    missingDeps?: string[];
    /** Present for external (uploaded) plugins with a resolvable folder. */
    folderName?: string;
    activeVersion?: string;
    versions?: string[];
}

export class PluginApi extends EventEmitter {
    private conn: ManagerApi;
    private plugins = [] as Plugin[];

    constructor(conn: ManagerApi) {
        super();
        this.conn = conn;

        // Listen for server-pushed plugin list updates (install / uninstall /
        // enable / disable). Replace the local cache and notify listeners.
        conn.routes.register({
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
        const res = await this.conn.rawRequest('api/plugins', 'GET', {});
        this.plugins = res.data as Plugin[];
        return this.plugins;
    }

    /** Force a fresh fetch and update the local cache. */
    public async refresh(): Promise<Plugin[]> {
        return this.getPlugins();
    }

    public async setEnabled(name: string, enabled: boolean): Promise<boolean> {
        const res = await this.conn.rawRequest(
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
        const res = await this.conn.rawRequest('api/plugins/upload', 'ACTION', {
            filename: file.name,
            chunks,
        });
        return (res.data as { id: string }).id;
    }

    public async uninstall(name: string) {
        await this.conn.rawRequest(
            `api/plugins/${encodeURIComponent(name)}`,
            'DELETE',
            {},
        );
    }

    public async setActiveVersion(
        name: string,
        version: string,
    ): Promise<Plugin> {
        const res = await this.conn.rawRequest(
            `api/plugins/${encodeURIComponent(name)}/version`,
            'ACTION',
            { version },
        );
        return res.data as Plugin;
    }

    public async deleteVersion(name: string, version: string): Promise<void> {
        await this.conn.rawRequest(
            `api/plugins/${encodeURIComponent(name)}/versions/${encodeURIComponent(version)}`,
            'DELETE',
            {},
        );
    }
}
