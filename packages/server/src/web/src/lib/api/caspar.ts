import { type REPClient } from 'rest-exchange-protocol-client';
import { casparLogs } from './broadcasts';
import { subscribeBroadcast } from './subscribeBroadcast';
import { getChunkCount } from './upload';
import type {
    Config as CasparConfig,
    Capabilities,
} from '../../../../manager/caspar/config/types';

export type { CasparConfig };
export type { Capabilities };

export interface CapabilitiesResponse {
    profile: string;
    capabilities: Capabilities;
}

export interface CasparStatus {
    running: boolean;
    supported: boolean;
    lastError: string | null;
}

export interface MediaDoc {
    id: string;

    mediaPath?: string;
    mediaSize?: number;
    mediaTime?: number;

    thumbSize?: number;
    thumbTime?: number;

    cinf?: string;
    tinf?: string;

    mediainfo?: {
        name: string;
        path: string;
        size: number;
        time: number;
        field_order: string;

        streams: {
            codec: {
                long_name: string;
                type: string;
                time_base: string;
                tag_string: string;
                is_avc: string | number | boolean;
            };

            width: number;
            height: number;
            sample_aspect_ratio: string;
            display_aspect_ratio: string;
            pix_fmt: string;
            bits_per_raw_sample: string;

            sample_fmt: string;
            sample_rate: number;
            channels: number;
            channel_layout: string;
            bits_per_sample: number;

            time_base: string;
            start_time: number;
            duration_ts: string;
            duration: string;

            bit_rate: string;
            max_bit_rate: string;
            nb_frames: string;
        }[];

        format: {
            name: string;
            long_name: string;
            size: number;

            start_time: number;
            duration: number;
            bit_rate: number;
            max_bit_rate: number;
        };
    };

    _attachments?: {
        'thumb.png': {
            content_type: string;
            data: Uint8Array;
        };
    };
}

// Mirrors the server cap in CasparProcess: an unbounded log string re-renders the LogViewer on every line and crashes the tab
const CLIENT_LOG_BUFFER_MAX = 256 * 1024;

function clampLogs(buf: string): string {
    return buf.length > CLIENT_LOG_BUFFER_MAX
        ? buf.slice(buf.length - CLIENT_LOG_BUFFER_MAX)
        : buf;
}

type LogsListener = (logs: string) => void;

export class CasparServerApi {
    private socket: REPClient;

    private logs: string = '';
    private logsListeners = new Set<LogsListener>();

    constructor(socket: REPClient) {
        this.socket = socket;

        subscribeBroadcast(
            socket.routes,
            casparLogs.path,
            casparLogs.method,
            data => {
                if (!casparLogs.isValid(data)) return;
                this.logs = clampLogs(this.logs + data);
                this.logsListeners.forEach(listener => listener(this.logs));
            },
        );
    }

    public on(event: 'logs', listener: LogsListener): this {
        if (event !== 'logs') return this;
        this.logsListeners.add(listener);
        return this;
    }

    public off(event: 'logs', listener: LogsListener): this {
        if (event !== 'logs') return this;
        this.logsListeners.delete(listener);
        return this;
    }

    public async start() {
        await this.socket.request('api/caspar/start', 'ACTION', {});
    }

    public async stop() {
        await this.socket.request('api/caspar/stop', 'ACTION', {});
    }

    public async restart() {
        await this.socket.request('api/caspar/restart', 'ACTION', {});
    }

    public async getLogs() {
        const res = await this.socket.request('api/caspar/logs', 'GET', {});
        this.logs = clampLogs((res as string) ?? '');

        return this.logs;
    }

    public async getStatus(): Promise<CasparStatus> {
        const res = await this.socket.request('api/caspar/status', 'GET', {});
        return res as CasparStatus;
    }

    public async getConfig(): Promise<CasparConfig> {
        const res = await this.socket.request('api/caspar/config', 'GET', {});
        return res as CasparConfig;
    }

    public async getRunningConfig(): Promise<CasparConfig | null> {
        const res = await this.socket.request(
            'api/caspar/running-config',
            'GET',
            {},
        );
        return (res as CasparConfig | null) ?? null;
    }

    public async getCapabilities(): Promise<CapabilitiesResponse> {
        const res = await this.socket.request(
            'api/caspar/capabilities',
            'GET',
            {},
        );
        return res as CapabilitiesResponse;
    }

    public async getAllMedia(): Promise<MediaDoc[]> {
        const res = await this.socket.request(
            'api/caspar/media/all',
            'GET',
            {},
        );
        return (res as MediaDoc[]) ?? [];
    }

    public async getFolders(): Promise<string[]> {
        const res = await this.socket.request(
            'api/caspar/media/folder',
            'GET',
            {},
        );
        return (res as { folders?: string[] })?.folders ?? [];
    }

    public async updateConfig(config: CasparConfig): Promise<CasparConfig> {
        const res = await this.socket.request(
            'api/caspar/config',
            'UPDATE',
            config,
        );
        return res as CasparConfig;
    }

    public async cancelUpload(id: string) {
        await this.socket.request('api/caspar/media/upload/cancel', 'ACTION', {
            id,
        });
    }

    public async uploadMedia(path: string, chunks: number | File) {
        if (typeof chunks !== 'number') chunks = getChunkCount(chunks);

        const res = await this.socket.request(
            'api/caspar/media/upload',
            'ACTION',
            {
                path,
                chunks,
            },
        );
        return (res as { id: string }).id;
    }

    public async deleteMedia(id: string): Promise<{ id: string }> {
        const res = await this.socket.request(
            `api/caspar/media/${encodeURIComponent(id)}`,
            'DELETE',
            {},
        );
        return res as { id: string };
    }

    public async renameMedia(
        id: string,
        newName: string,
    ): Promise<{ id: string; doc: MediaDoc | null }> {
        const res = await this.socket.request(
            `api/caspar/media/${encodeURIComponent(id)}`,
            'UPDATE',
            {
                name: newName,
            },
        );
        return res as { id: string; doc: MediaDoc | null };
    }

    public async moveMedia(
        id: string,
        newPath: string,
    ): Promise<{ id: string; doc: MediaDoc | null }> {
        const res = await this.socket.request(
            `api/caspar/media/${encodeURIComponent(id)}`,
            'UPDATE',
            {
                path: newPath,
            },
        );
        return res as { id: string; doc: MediaDoc | null };
    }

    public async createFolder(folderPath: string): Promise<{ path: string }> {
        const res = await this.socket.request(
            'api/caspar/media/folder',
            'CREATE',
            {
                path: folderPath,
            },
        );
        return { path: (res as { path: string } | null)?.path };
    }

    public async deleteFolder(
        folderPath: string,
        recursive = false,
    ): Promise<void> {
        await this.socket.request('api/caspar/media/folder', 'DELETE', {
            path: folderPath,
            recursive,
        });
    }

    public async renameFolder(
        from: string,
        to: string,
    ): Promise<{ path: string }> {
        const res = await this.socket.request(
            'api/caspar/media/folder',
            'UPDATE',
            { from, to },
        );
        return { path: (res as { path: string } | null)?.path };
    }
}
