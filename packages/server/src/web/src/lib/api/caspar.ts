import { type BroadcastDispatcher } from './broadcastDispatcher';
import { casparLogs } from './broadcasts';
import { type CheckedRepClient } from './repClient';
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

            // Video
            width: number;
            height: number;
            sample_aspect_ratio: string;
            display_aspect_ratio: string;
            pix_fmt: string;
            bits_per_raw_sample: string;

            // Audio
            sample_fmt: string;
            sample_rate: number;
            channels: number;
            channel_layout: string;
            bits_per_sample: number;

            // Common
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

// Mirror of the server-side cap in `CasparProcess`. Without this, an
// always-on log listener accumulates an unbounded string for the whole
// browser session — and since `emit('logs', this.logs)` ships the full
// buffer to React on every CasparCG line, the LogViewer would re-render
// a multi-MB pre block on every emit. That blocks navigation and
// eventually crashes the tab.
const CLIENT_LOG_BUFFER_MAX = 256 * 1024;

function clampLogs(buf: string): string {
    return buf.length > CLIENT_LOG_BUFFER_MAX
        ? buf.slice(buf.length - CLIENT_LOG_BUFFER_MAX)
        : buf;
}

type LogsListener = (logs: string) => void;

export class CasparServerApi {
    private socket: CheckedRepClient;

    private logs: string = '';
    private logsListeners = new Set<LogsListener>();

    constructor(socket: CheckedRepClient, broadcasts: BroadcastDispatcher) {
        this.socket = socket;

        broadcasts.subscribe(casparLogs.path, casparLogs.method, data => {
            if (!casparLogs.isValid(data)) return;
            this.logs = clampLogs(this.logs + data);
            this.logsListeners.forEach(listener => listener(this.logs));
        });
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
        this.logs = clampLogs((res.data as string) ?? '');

        return this.logs;
    }

    public async getStatus(): Promise<CasparStatus> {
        const res = await this.socket.request('api/caspar/status', 'GET', {});
        return res.data as CasparStatus;
    }

    public async getConfig(): Promise<CasparConfig> {
        const res = await this.socket.request('api/caspar/config', 'GET', {});
        return res.data as CasparConfig;
    }

    /** `null` = CasparCG is not running (or no snapshot yet) — a real value
     *  the server sends, distinct from `undefined` (query not resolved). */
    public async getRunningConfig(): Promise<CasparConfig | null> {
        const res = await this.socket.request(
            'api/caspar/running-config',
            'GET',
            {},
        );
        return (res.data as CasparConfig | null) ?? null;
    }

    public async getCapabilities(): Promise<CapabilitiesResponse> {
        const res = await this.socket.request(
            'api/caspar/capabilities',
            'GET',
            {},
        );
        return res.data as CapabilitiesResponse;
    }

    public async getAllMedia(): Promise<MediaDoc[]> {
        const res = await this.socket.request(
            'api/caspar/media/all',
            'GET',
            {},
        );
        return (res.data as MediaDoc[]) ?? [];
    }

    public async getFolders(): Promise<string[]> {
        const res = await this.socket.request(
            'api/caspar/media/folder',
            'GET',
            {},
        );
        return (res.data as { folders?: string[] })?.folders ?? [];
    }

    public async updateConfig(config: CasparConfig): Promise<CasparConfig> {
        const res = await this.socket.request(
            'api/caspar/config',
            'UPDATE',
            config,
        );
        return res.data as CasparConfig;
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
        return res.data.id;
    }

    public async deleteMedia(id: string): Promise<{ id: string }> {
        const res = await this.socket.request(
            `api/caspar/media/${encodeURIComponent(id)}`,
            'DELETE',
            {},
        );
        return res.data as { id: string };
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
        return res.data as { id: string; doc: MediaDoc | null };
    }

    /** Move a media file to a new location under the media root. `newPath`
     *  is slash-separated, relative to the root, no extension (the source
     *  file's extension is preserved). Use to drag media into a folder, or
     *  drop it onto a breadcrumb to move it back up the tree. */
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
        return res.data as { id: string; doc: MediaDoc | null };
    }

    /** Create a folder under the media root. `path` is slash-separated and
     *  relative to the root (e.g. `intro/concerts/2026`). Server drops a
     *  `.cgkeep` placeholder so the dir survives without media inside it. */
    public async createFolder(folderPath: string): Promise<{ path: string }> {
        const res = await this.socket.request(
            'api/caspar/media/folder',
            'CREATE',
            {
                path: folderPath,
            },
        );
        return { path: (res?.data as { path: string }).path };
    }

    /** Delete a folder under the media root. Server-side this only succeeds
     *  if the folder is empty (the `.cgkeep` placeholder doesn't count) —
     *  any real media or sub-folders inside cause a 409, unless `recursive`
     *  is set, which removes the folder and everything inside it. */
    public async deleteFolder(
        folderPath: string,
        recursive = false,
    ): Promise<void> {
        await this.socket.request('api/caspar/media/folder', 'DELETE', {
            path: folderPath,
            recursive,
        });
    }

    /** Rename a folder. Both paths are slash-separated and relative to the
     *  media root, no trailing slash. The directory is fs.rename'd as a
     *  unit so the contained media comes along (the scanner re-indexes on
     *  its next pass). Returns the new normalized path. */
    public async renameFolder(
        from: string,
        to: string,
    ): Promise<{ path: string }> {
        const res = await this.socket.request(
            'api/caspar/media/folder',
            'UPDATE',
            { from, to },
        );
        return { path: (res?.data as { path: string }).path };
    }
}
