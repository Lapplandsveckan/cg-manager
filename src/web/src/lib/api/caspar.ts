import EventEmitter from 'events';
import { type REPClient } from 'rest-exchange-protocol-client';
import { getChunkCount } from './upload';
import type { Config } from '../../../../manager/caspar/config/types';

export type CasparConfig = Omit<Config, '_raw'>;

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
                is_avc: any;
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
            size: string;

            start_time: number;
            duration: number;
            bit_rate: number;
            max_bit_rate: number;
        };
    };

    _attachments?: {
        'thumb.png': {
            content_type: string;
            data: Buffer;
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

export class CasparServerApi extends EventEmitter {
    private socket: REPClient;
    private status: CasparStatus = {
        running: false,
        supported: true,
        lastError: null,
    };
    private media = new Map<string, MediaDoc>();
    private runningConfig: CasparConfig | null = null;

    private logs: string = '';
    private _mediaPromise: Promise<Map<string, MediaDoc>>;

    constructor(socket: REPClient) {
        super();
        this.socket = socket;

        this.socket.routes.action('caspar/status', async request => {
            const status = request.data as CasparStatus;
            this.status = status;

            this.emit('status', status);
        });

        this.socket.routes.action('caspar/logs', async request => {
            const logs = request.data as string;
            this.logs = clampLogs(this.logs + logs);

            this.emit('logs', this.logs);
        });

        this.socket.routes.action('caspar/media', async request => {
            const { key, value } = request.data as {
                key: string;
                value: MediaDoc;
            };

            this.media.set(key, value);
            if (value === null) this.media.delete(key);

            this.emit('media', key, value);
        });

        this.socket.routes.action('caspar/running-config', async request => {
            // Server emits null when CasparCG is stopped — keep that as the
            // signal so consumers can hide live-only UI without polling.
            this.runningConfig = (request.data as CasparConfig | null) ?? null;
            this.emit('running-config', this.runningConfig);
        });

        this._mediaPromise = this.requestMedia();
        this._mediaPromise
            .then(() => (this._mediaPromise = null))
            .catch(e => console.error('Failed to get media', e));
    }

    private async requestMedia() {
        const res = await this.socket.request('api/caspar/media', 'GET', {});
        this.media.clear();

        const ids = res.data as string[];
        for (const id of ids) {
            const media = await this.socket
                .request(
                    `api/caspar/media/${encodeURIComponent(id)}`,
                    'GET',
                    {},
                )
                .then(v => v.data as MediaDoc);
            this.media.set(id, media);
        }

        return this.media;
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

    public async getStatus() {
        this.status = await this.socket
            .request('api/caspar/status', 'GET', {})
            .then(v => v.data);
        this.emit('status', this.status);

        return this.status;
    }

    public async getLogs() {
        const raw = await this.socket
            .request('api/caspar/logs', 'GET', {})
            .then(v => v.data as string);
        this.logs = clampLogs(raw ?? '');

        return this.logs;
    }

    public async getConfig(): Promise<CasparConfig> {
        const res = await this.socket.request('api/caspar/config', 'GET', {});
        return res.data as CasparConfig;
    }

    public async updateConfig(config: CasparConfig): Promise<CasparConfig> {
        const res = await this.socket.request(
            'api/caspar/config',
            'UPDATE',
            config,
        );
        return res.data as CasparConfig;
    }

    /** Snapshot of the config CasparCG was started with. `null` when the
     *  process isn't running, or when no snapshot has arrived yet. Pair
     *  with the 'running-config' event for live updates — the snapshot
     *  refreshes whenever CasparCG starts or stops. */
    public async getRunningConfig(): Promise<CasparConfig | null> {
        const res = await this.socket.request(
            'api/caspar/running-config',
            'GET',
            {},
        );
        this.runningConfig = (res.data as CasparConfig | null) ?? null;
        return this.runningConfig;
    }

    /** Cheap synchronous read of the last snapshot we have. Returns the
     *  same value as the most recent 'running-config' event (or null). */
    public getCachedRunningConfig(): CasparConfig | null {
        return this.runningConfig;
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

    public async getMedia() {
        if (this._mediaPromise) return this._mediaPromise;
        return this.media;
    }

    public async deleteMedia(id: string): Promise<void> {
        await this.socket.request(
            `api/caspar/media/${encodeURIComponent(id)}`,
            'DELETE',
            {},
        );
    }

    public async renameMedia(id: string, newName: string): Promise<void> {
        await this.socket.request(
            `api/caspar/media/${encodeURIComponent(id)}`,
            'UPDATE',
            {
                name: newName,
            },
        );
    }

    /** Move a media file to a new location under the media root. `newPath`
     *  is slash-separated, relative to the root, no extension (the source
     *  file's extension is preserved). Use to drag media into a folder, or
     *  drop it onto a breadcrumb to move it back up the tree. */
    public async moveMedia(id: string, newPath: string): Promise<void> {
        await this.socket.request(
            `api/caspar/media/${encodeURIComponent(id)}`,
            'UPDATE',
            {
                path: newPath,
            },
        );
    }

    /** Folders the user has created (plus any pre-existing dirs under the
     *  media root). Returned as upper-cased prefixes with trailing slash —
     *  matches the convention used by media IDs. The REP response is
     *  wrapped as `{data: ...}` (see getConfig / getStatus) — `.data` is
     *  the route's actual return value. */
    public async getFolders(): Promise<string[]> {
        const res = await this.socket.request(
            'api/caspar/media/folder',
            'GET',
            {},
        );
        return (res?.data as { folders?: string[] })?.folders ?? [];
    }

    /** Create a folder under the media root. `path` is slash-separated and
     *  relative to the root (e.g. `intro/concerts/2026`). Server drops a
     *  `.cgkeep` placeholder so the dir survives without media inside it.
     *  Emits `folders` locally so any MediaView in the same tab refetches. */
    public async createFolder(folderPath: string): Promise<{ path: string }> {
        const res = await this.socket.request(
            'api/caspar/media/folder',
            'CREATE',
            {
                path: folderPath,
            },
        );
        this.emit('folders');
        return { path: (res?.data as { path: string }).path };
    }

    /** Delete a folder under the media root. Server-side this only succeeds
     *  if the folder is empty (the `.cgkeep` placeholder doesn't count) —
     *  any real media or sub-folders inside cause a 409. */
    public async deleteFolder(folderPath: string): Promise<void> {
        await this.socket.request('api/caspar/media/folder', 'DELETE', {
            path: folderPath,
        });
        this.emit('folders');
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
        this.emit('folders');
        return { path: (res?.data as { path: string }).path };
    }
}
