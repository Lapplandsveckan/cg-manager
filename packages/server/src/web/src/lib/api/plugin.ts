import { type REPClient } from 'rest-exchange-protocol-client';
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

export class PluginApi {
    private socket: REPClient;

    constructor(socket: REPClient) {
        this.socket = socket;
    }

    public async getPlugins(): Promise<Plugin[]> {
        const res = await this.socket.request('api/plugins', 'GET', {});
        return res as Plugin[];
    }

    public async setEnabled(name: string, enabled: boolean): Promise<boolean> {
        const res = await this.socket.request(
            `api/plugins/${encodeURIComponent(name)}/status`,
            'ACTION',
            { enabled },
        );
        if (typeof res !== 'boolean')
            throw new Error(
                `Plugin toggle returned unexpected value: ${JSON.stringify(res)}`,
            );
        return res;
    }

    /** Create a plugin upload session and return the upload id.
     *  Pass the file directly; chunk count is computed here. */
    public async uploadPlugin(file: File): Promise<string> {
        const chunks = getChunkCount(file);
        const res = await this.socket.request('api/plugins/upload', 'ACTION', {
            filename: file.name,
            chunks,
        });
        return (res as { id: string }).id;
    }

    public async uninstall(name: string) {
        await this.socket.request(
            `api/plugins/${encodeURIComponent(name)}`,
            'DELETE',
            {},
        );
    }

    public async setActiveVersion(
        name: string,
        version: string,
    ): Promise<Plugin> {
        const res = await this.socket.request(
            `api/plugins/${encodeURIComponent(name)}/version`,
            'ACTION',
            { version },
        );
        return res as Plugin;
    }

    public async deleteVersion(name: string, version: string): Promise<void> {
        await this.socket.request(
            `api/plugins/${encodeURIComponent(name)}/versions/${encodeURIComponent(version)}`,
            'DELETE',
            {},
        );
    }
}
