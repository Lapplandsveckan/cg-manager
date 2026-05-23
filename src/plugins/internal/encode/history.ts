import {promises as fs} from 'fs';
import path from 'path';
import {noTryAsync} from 'no-try';

/**
 * Persistent rolling log of finished encodes — the "Recently encoded"
 * panel in the plugin UI is fed from this. Saved alongside the
 * encoder-state file so it survives manager restarts; capped to a
 * fixed number of entries so a long-running manager doesn't grow
 * the on-disk file without bound.
 */
export interface HistoryEntry {
    path: string;
    success: boolean;
    durationMs: number;
    completedAt: number;
    error?: string;
}

/** Cap on the in-memory + on-disk ring. 20 covers a working day of
 *  uploads without dropping anything an operator might want to see. */
export const HISTORY_LIMIT = 20;

export class EncodeHistory {
    private file: string;
    private entries: HistoryEntry[] = [];
    private saveTimer: NodeJS.Timeout | null = null;

    constructor(dir: string) {
        this.file = path.join(dir, 'history.json');
    }

    /** Read previously-persisted entries. Missing/corrupt files are
     *  treated as "fresh start" so a bad write doesn't lock the
     *  plugin out of recording new history. */
    async load(): Promise<void> {
        const [, raw] = await noTryAsync(() => fs.readFile(this.file, 'utf8'));
        if (!raw) return;
        const [, parsed] = await noTryAsync(async () => JSON.parse(raw));
        if (!Array.isArray(parsed)) return;
        this.entries = (parsed as HistoryEntry[])
            .filter((e) => e && typeof e.path === 'string')
            .slice(0, HISTORY_LIMIT);
    }

    /** Add a finished entry to the front of the ring, schedule a save. */
    push(entry: HistoryEntry): void {
        this.entries = [entry, ...this.entries].slice(0, HISTORY_LIMIT);
        this.scheduleSave();
    }

    /** Snapshot for the broadcast/REST payload. Returns the same array
     *  reference between calls when nothing changed — safe because
     *  callers shouldn't mutate it. */
    snapshot(): HistoryEntry[] {
        return this.entries;
    }

    /** Atomic write to disk, mirroring `EncodeState.flush`. */
    async flush(): Promise<void> {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
        const tmp = `${this.file}.tmp`;
        const data = JSON.stringify(this.entries);
        await noTryAsync(() => fs.writeFile(tmp, data, 'utf8'));
        await noTryAsync(() => fs.rename(tmp, this.file));
    }

    private scheduleSave() {
        if (this.saveTimer) return;
        this.saveTimer = setTimeout(() => {
            this.saveTimer = null;
            void this.flush();
        }, 1000).unref();
    }
}
