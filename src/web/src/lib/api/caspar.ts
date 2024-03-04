import {REPClient} from 'rest-exchange-protocol-client';
import EventEmitter from 'events';
import {getChunkCount} from './upload';

/**
 * All API calls relevant to CasparCG are handled here.
 */

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
            },

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
        },
    };

    _attachments?: {
        'thumb.png': {
            content_type: string;
            data: Buffer;
        }
    }
}

export class CasparServerApi extends EventEmitter {
    private socket: REPClient;
    private status: { running: boolean } = { running: false };
    private media = new Map<string, MediaDoc>();

    private logs: string = '';
    private _mediaPromise: Promise<Map<string, MediaDoc>>;

    constructor(socket: REPClient) {
        super();
        this.socket = socket;

        this.socket.routes.action('caspar/status', async (request) => {
            const status = request.data as { running: boolean };
            this.status = status;

            console.log('status', status);

            this.emit('status', status);
        });

        this.socket.routes.action('caspar/logs', async (request) => {
            const logs = request.data as string;
            this.logs += logs;

            this.emit('logs', this.logs);
        });

        this.socket.routes.action('caspar/media', async (request) => {
            const { key, value} = request.data as {key: string, value: MediaDoc};

            this.media.set(key, value);
            if (value === null) this.media.delete(key);

            this.emit('media', key, value);
        });

        this._mediaPromise = this.requestMedia();
        this._mediaPromise
            .then(() => this._mediaPromise = null)
            .catch(e => console.error('Failed to get media', e));
    }

    private async requestMedia() {
        const res = await this.socket.request('api/caspar/media', 'GET', {});
        this.media.clear();

        const ids = res.data as string[];
        for (const id of ids) {
            const media = await this.socket.request(`api/caspar/media/${encodeURIComponent(id)}`, 'GET', {}).then(v => v.data as MediaDoc);
            this.media.set(id, media);
        }

        return this.media;
    }

    /**
     * Starting caspar server.
     *
     */
    public async start() {
        await this.socket.request('api/caspar/start', 'ACTION', {});
    }

    /**
     * Stopping caspar server.
     */
    public async stop() {
        await this.socket.request('api/caspar/stop', 'ACTION', {});
    }

    /**
     * Restarting caspar server.
     */
    public async restart() {
        await this.socket.request('api/caspar/restart', 'ACTION', {});
    }

    /**
     * Getting caspar server status.
     */
    public async getStatus() {
        this.status = await this.socket.request('api/caspar/status', 'GET', {}).then(v => v.data);
        this.emit('status', this.status);

        return this.status;
    }

    public async getLogs() {
        this.logs = await this.socket.request('api/caspar/logs', 'GET', {}).then(v => v.data);

        return this.logs;
    }

    public async cancelUpload(id: string) {
        await this.socket.request('api/caspar/media/upload/cancel', 'ACTION', { id });
    }

    public async uploadMedia(path: string, chunks: number | File) {
        if (typeof chunks !== 'number') chunks = getChunkCount(chunks);

        const res = await this.socket.request('api/caspar/media/upload', 'ACTION', { path, chunks });
        return res.data.id;
    }

    public async getMedia() {
        if (this._mediaPromise) return this._mediaPromise;
        return this.media;
    }
}