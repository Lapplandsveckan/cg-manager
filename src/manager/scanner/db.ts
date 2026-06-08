import { EventEmitter } from 'events';
import { noTry } from 'no-try';

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

export class FileDatabase extends EventEmitter {
    private hash = new Map<string, MediaDoc>();
    private db = new Map<string, string>();
    // Recently-removed docs kept briefly so rename fast-path can reuse metadata
    private evicted = new Map<string, MediaDoc>();
    private static EVICTED_MAX = 50;

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
        return this.hash.get(hash) ?? this.evicted.get(hash);
    }

    getHash(id: string): string {
        return this.db.get(id);
    }

    private evict(hash: string, doc: MediaDoc): void {
        this.hash.delete(hash);
        this.evicted.set(hash, doc);
        if (this.evicted.size > FileDatabase.EVICTED_MAX)
            this.evicted.delete(this.evicted.keys().next().value);
    }

    put(hash: string, doc: MediaDoc): MediaDoc {
        this.evicted.delete(hash);
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

        if (hash) {
            // Only evict if this id is still the current owner of the hash slot.
            // After a rename, the slot is already claimed by the new id.
            if (doc?.id === id) this.evict(hash, doc);
        }

        this.db.delete(id);
        if (doc) return doc;
    }

    // Remove a stale id (e.g. the old name after a rename) without touching the
    // hash entry, which is already claimed by the new id after db.put().
    removeStaleId(id: string): void {
        const hash = this.db.get(id);
        if (hash) {
            const doc = this.hash.get(hash);
            // If content also changed, the old hash is orphaned — clean it up.
            if (doc?.id === id) this.evict(hash, doc);
        }
        this.emit('change', id, null);
        this.db.delete(id);
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
                Array.from(this.hash.entries()).filter(
                    ([_, value]) => !value._invalidate,
                ),
            ),
        );
    }

    load(data: string) {
        const [err, parsed] = noTry(() => JSON.parse(data));
        const hash = err ? {} : parsed;
        for (const [key, value] of Object.entries(hash))
            this.put(key, { ...(value as MediaDoc), _invalidate: true });
    }
}
