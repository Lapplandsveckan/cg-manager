import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import { noTryAsync } from 'no-try';
import { Logger } from '../../util/log';
import config from '../../util/config';
import { configuration } from '../config';
import { type Config } from './config/types';
import { isMockMode } from './mock';

export interface CasparStatus {
    running: boolean;
    supported: boolean;
    lastError: string | null;
}

const SUPPORTED_PLATFORMS: NodeJS.Platform[] = ['linux', 'win32'];

// Cap the in-memory log buffer so a long-running CasparCG instance doesn't
// grow the string unboundedly. The cap is also what `getLogs()` returns and
// what a newly-loaded client receives as the initial dump, so the browser
// never has to allocate more than this on first paint of the Server page.
const LOG_BUFFER_MAX = 256 * 1024;

const logger = Logger.scope('CasparCG');

// Uptime past which a crash is treated as fresh rather than part of the same
// crash-loop — resets the retry counter so an occasional crash months apart
// doesn't inherit a stale count.
const CRASH_STABLE_MS = 60_000;
const CRASH_RESTART_MAX = 5;
const CRASH_BACKOFF_BASE_MS = 1000;
const CRASH_BACKOFF_MAX_MS = 30_000;

export class CasparProcess extends EventEmitter {
    private process: ChildProcessWithoutNullStreams = null;
    private starting = false;
    private stopping = false;
    private startedAt = 0;
    private crashRestarts = 0;
    private crashTimer: NodeJS.Timeout | null = null;
    private logs = '';
    private lastError: string | null = null;
    private mockRunning = false;
    public config: Config;

    appendLog(data: string) {
        this.logs += data;
        if (this.logs.length > LOG_BUFFER_MAX)
            this.logs = this.logs.slice(this.logs.length - LOG_BUFFER_MAX);

        this.emit('log', data);
    }

    private get supported(): boolean {
        return isMockMode() || SUPPORTED_PLATFORMS.includes(process.platform);
    }

    async start() {
        // A user-initiated start gets a fresh crash budget — the auto-restart
        // path calls `_start()` directly so it doesn't reset the counter and
        // defeat the crash-loop cap.
        this.crashRestarts = 0;
        return this._start();
    }

    private async _start() {
        // `_start()` awaits configuration.get() before spawning, which means
        // two near-simultaneous callers (UI double-click, client retry) both
        // pass the `this.process` guard and both spawn. The `starting` flag
        // dedupes those concurrent calls.
        if (this.process || this.starting || this.mockRunning) return;
        this.starting = true;
        this.stopping = false;
        if (this.crashTimer) {
            clearTimeout(this.crashTimer);
            this.crashTimer = null;
        }

        await noTryAsync(async () => {
            configuration.setPath(this.casparPath);
            this.config = await configuration.get(true); // force re-read so running-config matches what's on disk

            if (isMockMode()) {
                this.lastError = null;
                this.mockRunning = true;
                logger.info(
                    'CASPAR_MOCK enabled — skipping real CasparCG process.',
                );
                this.emit('running-config', this.getRunningConfig());
                this.emit('status', this.getStatus());
                return;
            }

            if (!this.supported) {
                this.lastError = `CasparCG cannot be started on ${process.platform} — only Linux and Windows are supported.`;
                logger.error(this.lastError);
                this.emit('status', this.getStatus());
                return;
            }

            const cmd =
                process.platform === 'win32'
                    ? path.join(this.casparPath, 'casparcg.exe')
                    : path.join(this.casparPath, 'run.sh');

            this.lastError = null;
            // On Linux `run.sh` is a shell wrapper that spawns the real
            // casparcg binary as a child. Killing the shell's pid leaves that
            // child orphaned, so detach into a new process group and signal
            // the whole group on stop (see stop()). Windows spawns the exe
            // directly, so a plain kill suffices there.
            const detached = process.platform !== 'win32';
            const proc = spawn(cmd, [], { cwd: this.casparPath, detached });
            this.process = proc;
            this.startedAt = Date.now();

            // CasparCG read `this.config` from disk at startup — surface it as the
            // running snapshot so UI consumers (previews, routes) can distinguish
            // "what's actually live" from "what's on disk". Future edits to disk
            // don't update this until restart.
            this.emit('running-config', this.getRunningConfig());

            proc.stdout.on('data', data => {
                this.appendLog(data.toString());
                if (config['pipe-caspar']) logger.debug(data.toString());
            });
            proc.stderr.on('data', data => {
                this.appendLog(data.toString());
                logger.error(data.toString());
            });

            // A failure to even spawn the process (e.g. missing binary) isn't
            // something backoff can fix, so don't let it drive the auto-restart
            // loop — the following `close` (if any) checks this flag.
            let spawnFailed = false;
            proc.on('error', err => {
                spawnFailed = true;
                this.lastError = `Could not start CasparCG: ${err.message}`;
                logger.error(this.lastError);
                this.emit('status', this.getStatus());
            });

            proc.on('close', (code, signal) => {
                logger.warn(
                    `CasparCG exited with code ${code}${signal ? ` (signal ${signal})` : ''}`,
                );
                // Only react if `proc` is still the tracked process — guards
                // against a stale close from an older proc (nulling a newer
                // survivor's reference, polluting the crash counter, or
                // scheduling a bogus respawn).
                const wasCurrent = this.process === proc;
                if (wasCurrent) this.process = null;
                // A user-initiated stop/restart sets `stopping` before killing,
                // so that path never counts as an error or triggers a respawn
                // below — only an exit we didn't ask for does.
                if (wasCurrent && !this.stopping && (code !== 0 || signal))
                    this.lastError = `CasparCG exited with code ${code}${signal ? ` (signal ${signal})` : ''}.`;
                this.emit('status', this.getStatus());
                this.emit('running-config', this.getRunningConfig());

                if (
                    wasCurrent &&
                    !this.stopping &&
                    !spawnFailed &&
                    this.supported &&
                    config['caspar-auto-restart']
                ) {
                    if (Date.now() - this.startedAt > CRASH_STABLE_MS)
                        this.crashRestarts = 0;

                    if (this.crashRestarts < CRASH_RESTART_MAX) {
                        this.crashRestarts += 1;
                        const backoff = Math.min(
                            CRASH_BACKOFF_BASE_MS *
                                2 ** (this.crashRestarts - 1),
                            CRASH_BACKOFF_MAX_MS,
                        );
                        logger.warn(
                            `Auto-restarting CasparCG in ${backoff}ms (attempt ${this.crashRestarts}/${CRASH_RESTART_MAX})`,
                        );
                        this.crashTimer = setTimeout(
                            () => this._start(),
                            backoff,
                        );
                    } else {
                        logger.error(
                            `CasparCG crashed ${this.crashRestarts} times — giving up auto-restart.`,
                        );
                    }
                }
            });

            this.emit('status', this.getStatus());
        });

        this.starting = false;
    }

    async stop() {
        this.stopping = true;
        if (this.crashTimer) {
            clearTimeout(this.crashTimer);
            this.crashTimer = null;
        }

        if (this.mockRunning) {
            this.mockRunning = false;
            this.emit('status', this.getStatus());
            this.emit('running-config', this.getRunningConfig());
            return;
        }
        if (!this.process) return;
        const proc = this.process;
        const closed = new Promise<void>(resolve =>
            proc.once('close', () => resolve()),
        );
        // Kill the whole process group on Linux (negative pid) so the
        // casparcg child spawned by run.sh dies with the shell. Fall back to
        // killing just the pid if the group signal fails (e.g. the process
        // already exited and the group is gone).
        if (process.platform !== 'win32' && proc.pid) {
            const [err] = await noTryAsync(async () => process.kill(-proc.pid));
            if (err) proc.kill();
        } else {
            proc.kill();
        }
        await closed;
    }

    async restart() {
        await this.stop();
        await this.start();
    }

    get running() {
        return this.process !== null || this.mockRunning;
    }

    get log() {
        return this.logs;
    }

    getStatus(): CasparStatus {
        return {
            running: this.running,
            supported: this.supported,
            lastError: this.lastError,
        };
    }

    /** Config CasparCG was last started with. Null when the process isn't
     *  running. Edits saved to disk after start don't update this until
     *  the next start/restart — this is the "what's actually live" view. */
    getRunningConfig(): Config | null {
        return this.running ? this.config : null;
    }

    getLogs() {
        return this.logs;
    }

    get casparPath() {
        return config['caspar-path'] || process.cwd();
    }
}
