import {promises as fs} from 'fs';
import {noTryAsync} from 'no-try';

/**
 * Short-lived holding pen for sidecar files between an unlink and the
 * matching add event on a rename.
 *
 * The scanner emits a remove + add pair when a file is renamed — same
 * bytes, different path. Without this, the sidecar next to the old
 * path would be deleted by the remove handler and the new path would
 * be processed as if it were fresh (no exemption, encode would
 * happen). Holding the sidecar by hash for a few seconds and
 * claiming it inside `evaluate()` keeps the exempt flag attached to
 * the *content* across the rename window.
 *
 * Order of events from chokidar isn't guaranteed; the caller also
 * checks for an already-arrived rename target inside the removal
 * handler before parking, which covers the add-first case.
 */
export interface HeldSidecar {
    sidecarPath: string;
    timer: NodeJS.Timeout;
}

const DEFAULT_TTL_MS = 5000;

export class SidecarLimbo {
    private held = new Map<string, HeldSidecar>();
    private ttlMs: number;

    constructor(ttlMs = DEFAULT_TTL_MS) {
        this.ttlMs = ttlMs;
    }

    /** Park `sidecarPath` keyed by `hash`. After `ttlMs` with no
     *  matching claim the sidecar is unlinked — the rename never
     *  arrived and the operator clearly meant to remove the file. */
    hold(hash: string, sidecarPath: string): void {
        this.cancel(hash);

        const timer = setTimeout(() => {
            this.held.delete(hash);
            void noTryAsync(() => fs.unlink(sidecarPath));
        }, this.ttlMs);
        timer.unref();

        this.held.set(hash, { sidecarPath, timer });
    }

    /** Look up a held sidecar by hash and `fs.rename` it onto
     *  `newSidecarPath`. Returns true iff something was claimed and
     *  successfully moved. */
    async claim(hash: string, newSidecarPath: string): Promise<boolean> {
        const entry = this.held.get(hash);
        if (!entry) return false;
        clearTimeout(entry.timer);
        this.held.delete(hash);
        if (entry.sidecarPath === newSidecarPath) return true;
        const [err] = await noTryAsync(() => fs.rename(entry.sidecarPath, newSidecarPath));
        return !err;
    }

    /** Drop a held entry without unlinking — used when the caller
     *  has already handled the sidecar (e.g. moved it to a known
     *  destination inline). */
    cancel(hash: string): void {
        const entry = this.held.get(hash);
        if (!entry) return;
        clearTimeout(entry.timer);
        this.held.delete(hash);
    }

    /** Plugin shutdown — clear pending timers and unlink any
     *  remaining sidecars so we don't leak them to disk. */
    drain(): void {
        for (const [, entry] of this.held) {
            clearTimeout(entry.timer);
            void noTryAsync(() => fs.unlink(entry.sidecarPath));
        }
        this.held.clear();
    }
}
