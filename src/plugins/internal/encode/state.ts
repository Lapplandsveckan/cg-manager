import {promises as fs} from 'fs';
import path from 'path';
import {noTryAsync} from 'no-try';

/**
 * Per-content encoder state, keyed by the scanner's sha1. Hash is the
 * source of truth for "is this content encoded?" — renaming or moving
 * a file keeps the same hash, so the operator doesn't pay for a
 * needless re-encode just because the path changed. A genuine content
 * replacement (same path, new bytes) produces a new hash and falls
 * through to a real re-encode.
 *
 * Persisted alongside the plugin's history so failed attempts back
 * off across restarts instead of retry-looping at boot.
 */
export interface StateEntry {
    attempts: number;
    lastAttemptAt: number;
    lastError: string | null;
    /** True after a successful encode + atomic rename completed for
     *  this hash. (Note: the encoded file's hash differs from the
     *  source's — `completed: true` is written by the post-encode
     *  scan against the *new* hash.) */
    completed: boolean;
}

/** Time between failed attempts must be at least this much. Stops a
 *  hard-failing source from re-trying every db-change tick. */
export const RETRY_BACKOFF_MS = 30 * 60 * 1000;
/** After this many failures, the plugin gives up on the file until
 *  its content (and therefore its hash) changes. */
export const MAX_ATTEMPTS = 5;

export class EncodeState {
    private file: string;
    private dir: string;
    private entries = new Map<string, StateEntry>();
    private loaded = false;
    // Saves are debounced: a burst of `set()` calls during the
    // first-pass scan collapses into one disk write.
    private saveTimer: NodeJS.Timeout | null = null;

    constructor(rootDir: string) {
        this.dir = rootDir;
        this.file = path.join(rootDir, 'state.json');
    }

    async load(): Promise<void> {
        if (this.loaded) return;
        this.loaded = true;

        await noTryAsync(() => fs.mkdir(this.dir, {recursive: true}));
        const [err, raw] = await noTryAsync(() => fs.readFile(this.file, 'utf8'));
        if (err || !raw) return;

        const [parseErr, parsed] = await noTryAsync(async () => JSON.parse(raw));
        if (parseErr || !parsed || typeof parsed !== 'object') return;

        for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
            if (!v || typeof v !== 'object') continue;
            const e = v as Partial<StateEntry>;
            this.entries.set(k, {
                attempts: e.attempts ?? 0,
                lastAttemptAt: e.lastAttemptAt ?? 0,
                lastError: e.lastError ?? null,
                completed: e.completed ?? false,
            });
        }
    }

    /** Lookup by content hash. Returns null if we've never touched
     *  this content. */
    get(hash: string): StateEntry | null {
        return this.entries.get(hash) ?? null;
    }

    set(hash: string, entry: StateEntry): void {
        this.entries.set(hash, entry);
        this.scheduleSave();
    }

    delete(hash: string): void {
        if (this.entries.delete(hash)) this.scheduleSave();
    }

    /** Atomic write to disk: serialise → tmp → rename. A crash
     *  mid-write leaves either the previous good state or an
     *  orphan `.tmp` we can clean up later. */
    async flush(): Promise<void> {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }

        const data = JSON.stringify(Object.fromEntries(this.entries), null, 2);
        const tmp = `${this.file}.tmp`;
        await noTryAsync(() => fs.writeFile(tmp, data, 'utf8'));
        await noTryAsync(() => fs.rename(tmp, this.file));
    }

    private scheduleSave() {
        if (this.saveTimer) return;
        // 1s coalescing window — enough to batch a first-pass burst
        // without losing too much on a crash.
        this.saveTimer = setTimeout(() => {
            this.saveTimer = null;
            void this.flush();
        }, 1000).unref();
    }
}
