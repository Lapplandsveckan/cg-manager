import PouchDB from 'pouchdb-node';

import config from './config';
import Scanner from './scanner';
import App from './app';

export interface MediaDoc {
    _id: string;

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
                is_avc: boolean;
            },

            // Video
            width: number;
            height: number;
            sample_aspect_ratio: string;
            display_aspect_ratio: string;
            pix_fmt: string;
            bits_per_raw_sample: number;

            // Audio
            sample_fmt: string;
            sample_rate: number;
            channels: number;
            channel_layout: string;
            bits_per_sample: number;

            // Common
            time_base: string;
            start_time: string;
            duration_ts: number;
            duration: number;

            bit_rate: number;
            max_bit_rate: number;
            nb_frames: number;
        }[];

        format: {
            name: string;
            long_name: string;
            size: string;

            start_time: string;
            duration: string;
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

function start() {
    const db = new PouchDB<MediaDoc>(`http://127.0.0.1:${config.http.port}/db/_media`);
    const scanner = Scanner(db);
    const app = App(db);
    const server = app.listen(config.http.port);

    return async () => {
        server.close();

        await scanner.stop();
        await db.close();
    };
}

export class MediaScanner {
    private cancel: () => void = null;

    async start() {
        if (this.cancel) return;
        this.cancel = await start();
    }

    async stop() {
        if (!this.cancel) return;
        await this.cancel();
        this.cancel = null;
    }
}