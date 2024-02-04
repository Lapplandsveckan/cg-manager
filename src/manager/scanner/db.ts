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

export class FileDatabase {
    private db = new Map<string, MediaDoc>();
    private static instance: FileDatabase;
    public static get db() {
        return FileDatabase.instance;
    }

    constructor() {
        FileDatabase.instance = this;
    }

    get(id: string): MediaDoc {
        return this.db.get(id);
    }

    put(id: string, doc: MediaDoc): MediaDoc {
        this.db.set(id, doc);
        return doc;
    }

    remove(id: string): MediaDoc {
        const doc = this.db.get(id);
        return this.db.delete(id) ? doc : null;
    }

    allDocs(): MediaDoc[] {
        return Array.from(this.db.values());
    }

    close() {
        this.db.clear();
    }
}