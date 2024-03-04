import {EventEmitter} from 'events';
import {hashFile} from './util';

export interface MediaDoc {
    id: string;
    _invalidate?: boolean;

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

export class FileDatabase extends EventEmitter {
    private hash = new Map<string, MediaDoc>();

    private db = new Map<string, string>();
    private static instance: FileDatabase;

    public static get db() {
        return FileDatabase.instance;
    }

    constructor() {
        super();
        FileDatabase.instance = this;
    }

    get(id: string): MediaDoc {
        const hash = this.getHash(id);
        return hash ? this.retrieve(hash) : null;
    }

    retrieve(hash: string): MediaDoc {
        return this.hash.get(hash);
    }

    getHash(id: string): string {
        return this.db.get(id);
    }

    put(hash: string, doc: MediaDoc): MediaDoc {
        const id = doc.id;

        this.db.set(id, hash);
        this.hash.set(hash, doc);

        this.emit('change', id, doc);
        return doc;
    }

    remove(id: string): MediaDoc {
        const hash = this.db.get(id);
        const doc = hash ? this.hash.get(hash) : null;
        this.emit('change', id, null);

        if (hash) this.hash.delete(hash);

        this.db.delete(id);
        if (doc) return doc;
    }

    allDocs(): MediaDoc[] {
        return Array.from(this.db.values()).map(id => this.hash.get(id));
    }

    close() {
        this.db.clear();
        this.hash.clear();
    }

    save() {
        return JSON.stringify(
            Object.fromEntries(
                Array.from(this.hash.entries())
                    .filter(([_, value]) => !value._invalidate),
            ),
        );
    }

    load(data: string) {
        const hash = JSON.parse(data);
        for (const [key, value] of Object.entries(hash))
            this.put(key, {...(value as MediaDoc), _invalidate: true});
    }
}