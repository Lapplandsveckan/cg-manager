import EventEmitter from 'events';
import { type REPClient } from 'rest-exchange-protocol-client';
import { getChunkCount } from './upload';
import type { Config as CasparConfig } from '../../../../manager/caspar/config/types';
import type { Capabilities } from '../../../../manager/caspar/config/profiles';

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

/** The REP websocket transport resolves every reply, success or failure —
 *  it never rejects the request promise. A failed request comes back as
 *  `{status, error}` instead of `{status: 200, data}`. Carries `.status`
 *  so callers can branch on the code (e.g. a 409 "folder not empty"). */
export class RequestError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

export function assertOk(res: { status?: number; error?: string } | undefined) {
    if (res && typeof res.status === 'number' && res.status >= 400)
        throw new RequestError(res.error ?? 'Request failed', res.status);
}

export class CasparServerApi extends EventEmitter {
    private socket: REPClient;

    private logs: string = '';

    constructor(socket: REPClient) {
        super();
        this.socket = socket;

        this.socket.routes.action('caspar/logs', async request => {
            const logs = request.data as string;
            this.logs = clampLogs(this.logs + logs);

            this.emit('logs', this.logs);
        });
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

    public async getStatus(): Promise<CasparStatus> {
        const res = await this.socket.request('api/caspar/status', 'GET', {});
        return res.data as CasparStatus;
    }

    public async getLogs() {
        const raw = await this.socket
            .request('api/caspar/logs', 'GET', {})
            .then(v => v.data as string);
        this.logs = clampLogs(raw ?? '');

        return this.logs;
    }

    public async getCapabilities(): Promise<CapabilitiesResponse> {
        const res = await this.socket.request(
            'api/caspar/capabilities',
            'GET',
            {},
        );
        return res.data as CapabilitiesResponse;
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
        assertOk(res);
        return res.data as CasparConfig;
    }

    /** Snapshot of the config CasparCG was started with. `null` when the
     *  process isn't running, or when no snapshot has arrived yet. React
     *  consumers should use useRunningConfigQuery (lib/query/caspar.ts)
     *  instead — the snapshot refreshes there whenever CasparCG starts or
     *  stops, via the 'caspar/running-config' broadcast. */
    public async getRunningConfig(): Promise<CasparConfig | null> {
        const res = await this.socket.request(
            'api/caspar/running-config',
            'GET',
            {},
        );
        return (res.data as CasparConfig | null) ?? null;
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

    public async deleteMedia(id: string): Promise<void> {
        assertOk(
            await this.socket.request(
                `api/caspar/media/${encodeURIComponent(id)}`,
                'DELETE',
                {},
            ),
        );
    }

    public async renameMedia(id: string, newName: string): Promise<void> {
        assertOk(
            await this.socket.request(
                `api/caspar/media/${encodeURIComponent(id)}`,
                'UPDATE',
                {
                    name: newName,
                },
            ),
        );
    }

    /** Move a media file to a new location under the media root. `newPath`
     *  is slash-separated, relative to the root, no extension (the source
     *  file's extension is preserved). Use to drag media into a folder, or
     *  drop it onto a breadcrumb to move it back up the tree. */
    public async moveMedia(id: string, newPath: string): Promise<void> {
        assertOk(
            await this.socket.request(
                `api/caspar/media/${encodeURIComponent(id)}`,
                'UPDATE',
                {
                    path: newPath,
                },
            ),
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
     *  `.cgkeep` placeholder so the dir survives without media inside it. */
    public async createFolder(folderPath: string): Promise<{ path: string }> {
        const res = await this.socket.request(
            'api/caspar/media/folder',
            'CREATE',
            {
                path: folderPath,
            },
        );
        assertOk(res);
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
        assertOk(
            await this.socket.request('api/caspar/media/folder', 'DELETE', {
                path: folderPath,
                recursive,
            }),
        );
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
        assertOk(res);
        return { path: (res?.data as { path: string }).path };
    }
}
