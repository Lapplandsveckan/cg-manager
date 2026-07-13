import { EventEmitter } from 'events';
import { noTry } from 'no-try';

export interface MediaDoc {
    id: string;
    _invalidate?: boolean;
    _hash?: string;

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
    // Primary store: id → doc
    private docs = new Map<string, MediaDoc>();
    // Secondary index: content hash → set of ids (for metadata reuse across copies)
    private byHash = new Map<string, Set<string>>();
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

    get(id: string): MediaDoc | undefined {
        return this.docs.get(id) ?? this.evicted.get(id);
    }

    // Whether the id is in the live store (not just lingering in `evicted`).
    has(id: string): boolean {
        return this.docs.has(id);
    }

    // Find any live doc sharing the same content hash (for metadata reuse).
    // Falls back to any evicted doc with that hash.
    findByHash(hash: string): MediaDoc | undefined {
        const ids = this.byHash.get(hash);
        if (ids?.size) return this.docs.get(ids.values().next().value);
        for (const doc of this.evicted.values())
            if (doc._hash === hash) return doc;
        return undefined;
    }

    getHash(id: string): string | undefined {
        return this.docs.get(id)?._hash;
    }

    private evict(id: string, doc: MediaDoc): void {
        this.docs.delete(id);
        this.removeFromByHash(id, doc._hash);
        this.evicted.set(id, doc);
        if (this.evicted.size > FileDatabase.EVICTED_MAX)
            this.evicted.delete(this.evicted.keys().next().value);
    }

    private removeFromByHash(id: string, hash: string | undefined): void {
        if (!hash) return;
        const ids = this.byHash.get(hash);
        if (!ids) return;
        ids.delete(id);
        if (!ids.size) this.byHash.delete(hash);
    }

    put(hash: string, doc: MediaDoc): MediaDoc {
        this.evicted.delete(doc.id);
        const id = doc.id;

        // Update byHash index: remove from old bucket if hash changed
        const oldHash = this.docs.get(id)?._hash;
        if (oldHash && oldHash !== hash) this.removeFromByHash(id, oldHash);

        doc._hash = hash;
        this.docs.set(id, doc);

        if (!this.byHash.has(hash)) this.byHash.set(hash, new Set());
        this.byHash.get(hash).add(id);

        this.emit('change', id, doc);
        return doc;
    }

    remove(id: string): MediaDoc | undefined {
        const doc = this.docs.get(id);
        this.emit('change', id, null);

        if (doc) this.evict(id, doc);
        else this.docs.delete(id);

        return doc;
    }

    // Remove a stale id (e.g. the old name after a rename) without evicting the
    // doc if ownership has already transferred to another id.
    removeStaleId(id: string): void {
        const doc = this.docs.get(id);
        if (doc) {
            // If the doc still belongs to this id, evict it
            if (doc.id === id) this.evict(id, doc);
            else this.docs.delete(id);
        }
        this.emit('change', id, null);
    }

    allDocs(): MediaDoc[] {
        return Array.from(this.docs.values());
    }

    close() {
        this.docs.clear();
        this.byHash.clear();
    }

    save() {
        return JSON.stringify(
            Object.fromEntries(
                Array.from(this.docs.entries()).filter(
                    ([_, value]) => !value._invalidate,
                ),
            ),
        );
    }

    load(data: string) {
        const [err, parsed] = noTry(() => JSON.parse(data));
        const entries = err ? {} : parsed;
        for (const [key, value] of Object.entries(entries)) {
            const doc = value as MediaDoc;
            // id may be stored in the value (new format) or keyed by id
            if (!doc.id) doc.id = key;
            this.put(doc._hash ?? key, { ...doc, _invalidate: true });
        }
    }
}
