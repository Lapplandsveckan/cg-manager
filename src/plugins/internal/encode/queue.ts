/**
 * Single-worker FIFO queue. Worker callback receives the next job and
 * an AbortSignal it should honour; the queue itself doesn't know what
 * a "job" is beyond a key for dedup + cancellation.
 *
 * Concurrency cap is fixed at 1 for now — single encode at a time is
 * cheap (encoder process is OS-niced anyway) and avoids head-of-line
 * problems with disk I/O when multiple jobs run on a single spinner.
 * Lifted later if real-world testing shows N=2-4 is fine.
 */
export interface QueueJob {
    /** Unique key for dedup + cancel lookups. Use the source path. */
    key: string;
}

export interface QueueSnapshot<J extends QueueJob> {
    active: J | null;
    pending: J[];
}

export class EncodeQueue<J extends QueueJob> {
    private pending: J[] = [];
    private active: { job: J; abort: AbortController } | null = null;
    private worker: (job: J, signal: AbortSignal) => Promise<void>;
    private shutdown = false;
    private onChange?: () => void;

    constructor(
        worker: (job: J, signal: AbortSignal) => Promise<void>,
        opts?: { onChange?: () => void },
    ) {
        this.worker = worker;
        this.onChange = opts?.onChange;
    }

    /** Snapshot used to surface state to the UI. Returns the same shape
     *  for both states (idle / busy) so callers don't have to special-case. */
    public snapshot(): QueueSnapshot<J> {
        return {
            active: this.active?.job ?? null,
            pending: [...this.pending],
        };
    }

    /** Add a job to the back of the queue. No-op if the same key is
     *  already pending or running — useful when the same path arrives
     *  through both the first-pass scan and the live db change event. */
    enqueue(job: J): void {
        if (this.shutdown) return;
        if (this.active?.job.key === job.key) return;
        if (this.pending.some((p) => p.key === job.key)) return;
        this.pending.push(job);
        this.onChange?.();
        void this.drain();
    }

    /** Cancel a job — aborts it if running, drops it from the queue
     *  otherwise. Idempotent. */
    cancel(key: string): void {
        if (this.active?.job.key === key) {
            this.active.abort.abort();
            return;
        }
        const idx = this.pending.findIndex((p) => p.key === key);
        if (idx !== -1) {
            this.pending.splice(idx, 1);
            this.onChange?.();
        }
    }

    /** Stop accepting jobs and cancel any in flight. Call on plugin
     *  disable so a re-enable can start clean without inheriting a
     *  half-finished encode that will write into the wrong tmp dir. */
    stop(): void {
        this.shutdown = true;
        this.pending = [];
        if (this.active) this.active.abort.abort();
        this.onChange?.();
    }

    /** Drives the queue. Recursive call after each job keeps the
     *  await chain shallow even for huge queues. */
    private async drain(): Promise<void> {
        if (this.active || this.shutdown) return;
        const job = this.pending.shift();
        if (!job) return;

        const abort = new AbortController();
        this.active = { job, abort };
        this.onChange?.();
        try {
            await this.worker(job, abort.signal);
        } catch {
            // Worker is responsible for logging — queue just keeps
            // draining. We never want one bad file to wedge the queue.
        }
        this.active = null;
        this.onChange?.();
        void this.drain();
    }
}
