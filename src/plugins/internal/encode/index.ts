import {promises as fs} from 'fs';
import path from 'path';
import os from 'os';
import {CasparPlugin} from '@lappis/cg-manager';
import {WebsocketOutboundMethod} from 'rest-exchange-protocol';
import {UI_INJECTION_ZONE} from '../../../manager/plugins/ui';
import {noTryAsync} from 'no-try';
import {EncodeQueue} from './queue';
import {EncodeState, MAX_ATTEMPTS, RETRY_BACKOFF_MS} from './state';
import {EncodeHistory, HistoryEntry} from './history';
import {ENCODER_VERSION, probeEncoderVersion} from './probe';
import {encode, encodeImage} from './encoder';
import {isExempt, setExempt} from './exempt';
import {SidecarLimbo} from './limbo';
import {MediaKind, kindFor} from './media-kind';

/** Public-facing snapshot of the plugin's runtime state. The UI subscribes
 *  to `encode/state` broadcasts of this shape (plus an initial GET) so it
 *  can render the queue, the active job's progress, and recent history
 *  without polling. */
interface EncodeStateSnapshot {
    active: {
        path: string;
        startedAt: number;
        progressMs: number;
        durationMs?: number;
    } | null;
    pending: { path: string }[];
    recent: HistoryEntry[];
}

/** Throttle progress broadcasts so we don't ship 200 messages/sec when
 *  ffmpeg flushes a fast section. 250ms gives a smooth-looking bar
 *  without flooding the WS. */
const PROGRESS_BROADCAST_MS = 250;

interface Job {
    key: string;             // source path (also the queue dedup key)
    /** Content hash from the scanner — used as the state-cache key so
     *  renames / moves don't trigger needless re-encodes. */
    hash: string;
    kind: MediaKind;
    /** Captured at queue time, only used for the "was the source
     *  replaced while we were encoding?" race check in `run()`. */
    mtime: number;
    size: number;
    /** Source duration in ms (from the scanner's ffprobe), so the UI
     *  can show a real progress percentage. Undefined for images and
     *  for any source whose mediainfo didn't include a duration. */
    durationMs?: number;
}

interface MediaDocLike {
    mediaPath?: string;
    mediaSize?: number;
    mediaTime?: number;
    mediainfo?: { format?: { duration?: string | number } };
}

const PLUGIN_NAME = 'encode';

/** Re-encodes media into a CasparCG-friendly normalised form when not
 *  already encoded. Plugs into the FileDatabase, persists per-file
 *  state to `<cwd>/plugin-data/encode/`, writes via `os.tmpdir()` →
 *  atomic rename, spawns ffmpeg at PRIORITY_LOW. */
export default class EncodePlugin extends CasparPlugin {
    private state: EncodeState;
    private queue: EncodeQueue<Job> | null = null;
    private dbChangeHandler: ((id: string, doc: MediaDocLike | null) => void) | null = null;
    private route: ReturnType<typeof EncodePlugin.prototype.registerRoute> | null = null;
    private exemptRoute: ReturnType<typeof EncodePlugin.prototype.registerRoute> | null = null;

    // Live progress for the active job, mirrored into the broadcast.
    private activeStartedAt = 0;
    private activeProgressMs = 0;
    private lastProgressBroadcastAt = 0;
    // Persisted ring of finished jobs; owns its own save/load.
    private history: EncodeHistory | null = null;
    // Holds sidecars between unlink + add so exempt-markers follow renames.
    private limbo = new SidecarLimbo();

    public static get pluginName() {
        return PLUGIN_NAME;
    }

    protected async onEnable() {
        const dataDir = path.join(process.cwd(), 'plugin-data', PLUGIN_NAME);
        this.state = new EncodeState(dataDir);
        await this.state.load();

        this.history = new EncodeHistory(dataDir);
        await this.history.load();

        this.queue = new EncodeQueue<Job>(
            (job, signal) => this.run(job, signal),
            { onChange: () => this.broadcastState() },
        );

        // Live updates: scanner emits a 'change' for every doc add /
        // update / remove. Adds/updates → re-evaluate; removes →
        // clean up after ourselves (queue, sidecar, persisted state).
        this.dbChangeHandler = (id, doc) => {
            if (!doc) return this.handleRemoval(id);
            void this.evaluate(doc);
        };
        const db = this.api.getFileDatabase();
        db.on('change', this.dbChangeHandler);

        // First-pass: iterate everything the scanner already knows
        // about. The metadata probe handles "already encoded" without
        // touching the state file, so a fresh install on an existing
        // media library still benefits.
        this.logger.info('First-pass scan — evaluating existing media for re-encode');
        for (const doc of db.allDocs() as MediaDocLike[])
            await this.evaluate(doc);

        // REP endpoints + the page UI. The `?` after `this.api` is for
        // future-proofing: registerRoute is a no-op return value, we
        // just store it for unregister on disable.
        this.route = this.registerRoute();
        this.exemptRoute = this.registerExemptRoute();
        this.registerPage();
        this.registerUploadOption();
    }

    protected async onDisable() {
        const db = this.api.getFileDatabase();
        if (this.dbChangeHandler) db.off('change', this.dbChangeHandler);
        this.dbChangeHandler = null;

        if (this.route) this.api.unregisterRoute(this.route);
        this.route = null;
        if (this.exemptRoute) this.api.unregisterRoute(this.exemptRoute);
        this.exemptRoute = null;

        this.queue?.stop();
        this.queue = null;

        this.limbo.drain();

        await this.state?.flush();
        await this.history?.flush();
        this.history = null;
    }

    /** Build the current snapshot from queue + active progress + history.
     *  Synchronous + cheap — safe to call from any throttled broadcast. */
    private snapshot(): EncodeStateSnapshot {
        const q = this.queue?.snapshot() ?? { active: null, pending: [] };
        return {
            active: q.active
                ? {
                    path: q.active.key,
                    startedAt: this.activeStartedAt,
                    progressMs: this.activeProgressMs,
                    durationMs: q.active.durationMs,
                }
                : null,
            pending: q.pending.map((p) => ({ path: p.key })),
            recent: this.history?.snapshot() ?? [],
        };
    }

    private broadcastState() {
        // PluginAPI prefixes broadcasts + routes with `plugin/<pluginName>/`,
        // so the topic on the wire ends up as `plugin/encode/state`. The
        // UI subscribes to that full path.
        this.api.broadcast('state', WebsocketOutboundMethod.ACTION, this.snapshot());
    }

    /** Same payload as `broadcastState()` but throttled so a fast-running
     *  encode (whose `-progress pipe:1` flushes several times a second)
     *  doesn't flood every connected client. */
    private broadcastProgress() {
        const now = Date.now();
        if (now - this.lastProgressBroadcastAt < PROGRESS_BROADCAST_MS) return;
        this.lastProgressBroadcastAt = now;
        this.broadcastState();
    }

    private pushHistory(entry: HistoryEntry) {
        this.history?.push(entry);
        this.broadcastState();
    }

    private registerRoute() {
        // PluginAPI prefixes the path with `plugin/<pluginName>/`, so the
        // final route is `/api/plugin/encode/state`. Clients then follow
        // the matching `plugin/encode/state` action broadcasts for live
        // updates.
        return this.api.registerRoute(
            'state',
            async () => this.snapshot(),
            'GET' as any,
        );
    }

    private registerPage() {
        // The plugin-page injection zone renders our UI inside
        // `/plugins/encode`. The file is webpack-bundled at runtime by
        // the manager's UIInjector with React/MUI/web-lib as externals.
        this.api.registerUI(
            UI_INJECTION_ZONE.PLUGIN_PAGE,
            path.join(__dirname, 'ui', 'index.tsx'),
        );
    }

    private registerUploadOption() {
        // Renders a "Skip encoding" checkbox inside the core Upload
        // modal. Toggling it calls our exempt endpoint, which writes
        // the `.cgnoencode` sidecar before the file finishes uploading.
        this.api.registerUI(
            (UI_INJECTION_ZONE as any).UPLOAD_OPTIONS ?? 'upload-options',
            path.join(__dirname, 'ui', 'upload-option.tsx'),
        );
    }

    /**
     * POST /api/plugin/encode/exempt — `{path: string, exempt: boolean}`.
     * Toggles the `<path>.cgnoencode` sidecar inside the media root.
     * Cancels any matching in-flight encode when a file is exempted
     * mid-job so the encoder isn't fighting the operator's intent.
     */
    private registerExemptRoute() {
        return this.api.registerRoute(
            'exempt',
            async (request: any) => {
                const data = request.getData?.() ?? request.data ?? {};
                const result = await setExempt(data?.path, Boolean(data?.exempt));
                if (!result.ok) return result;

                if (data?.exempt && this.queue && result.target) {
                    const snap = this.queue.snapshot();
                    if (snap.active?.key === result.target) {
                        this.queue.cancel(result.target);
                        this.logger.info(`Cancelled active encode after exemption: ${result.target}`);
                    }
                }
                return {ok: true};
            },
            'ACTION' as any,
        );
    }

    /**
     * Decide whether `doc` needs encoding right now. Cheap checks
     * (state lookup, attempt-count) run first; only candidates that
     * survive those go to the ffmpeg probe (~100ms). Survivors are
     * queued; everything else is silently skipped.
     */
    private async evaluate(doc: MediaDocLike): Promise<void> {
        if (!doc?.mediaPath) return;
        if (typeof doc.mediaSize !== 'number' || typeof doc.mediaTime !== 'number') return;

        const filePath = doc.mediaPath;
        const kind = kindFor(filePath);
        // Anything that isn't a recognised video container or image is
        // ignored entirely — XML templates, sidecar JSONs, etc.
        if (!kind) return;

        // Hash-keyed state — survives renames + moves so the operator
        // doesn't pay for a needless re-encode just because the path
        // changed. The scanner has already hashed the file by the time
        // we see it here.
        const id = (doc as { id?: string }).id;
        const hash = id ? this.api.getFileDatabase().getHash(id) : null;
        if (!hash) return;

        // Rename recovery: a recent unlink may have parked a sidecar
        // keyed by this hash. Claim it onto the new path *before* the
        // exempt check so the exempt marker actually takes effect.
        await this.limbo.claim(hash, `${filePath}.cgskip`);

        // Sidecar / parent-marker exemption — lets operators keep raw
        // assets (transparent VP8 cards, master files) untouched. Done
        // before the state-cache check so adding the marker to an
        // already-attempted file takes effect immediately.
        if (await isExempt(filePath)) return;

        const mtime = doc.mediaTime;
        const size = doc.mediaSize;

        const entry = this.state.get(hash);
        if (entry?.completed) return;
        if (entry && entry.attempts >= MAX_ATTEMPTS) {
            this.logger.debug(`Skipping ${filePath} — ${entry.attempts} prior failures`);
            return;
        }
        if (entry && Date.now() - entry.lastAttemptAt < RETRY_BACKOFF_MS) {
            this.logger.debug(`Skipping ${filePath} — within retry backoff`);
            return;
        }

        // ffmpeg-metadata probe — bounded by container header size, not
        // file size. ~100ms even on huge files.
        const version = await probeEncoderVersion(filePath);
        if (version !== null) {
            // Already stamped. Record under the hash so future restarts
            // skip the probe round-trip entirely.
            this.state.set(hash, {
                attempts: entry?.attempts ?? 0,
                lastAttemptAt: Date.now(),
                lastError: null,
                completed: true,
            });
            this.logger.debug(`${filePath} already encoded (v${version})`);
            return;
        }

        // Lift source duration off the scanner-populated mediainfo so the
        // UI can show a real progress bar. ffprobe already ran during the
        // initial scan; this is just reaching into the cached doc.
        const rawDuration = doc.mediainfo?.format?.duration;
        const durationSec = typeof rawDuration === 'number'
            ? rawDuration
            : typeof rawDuration === 'string' ? parseFloat(rawDuration) : NaN;
        const durationMs = Number.isFinite(durationSec) ? durationSec * 1000 : undefined;

        this.queue?.enqueue({ key: filePath, hash, kind, mtime, size, durationMs });
        this.logger.info(`Queued ${filePath} for re-encode`);
    }

    /**
     * Per-job worker. Owns the temp file lifecycle: created when we
     * spawn ffmpeg, deleted (or renamed into place) when the encode
     * finishes one way or another. On success, the source file is
     * replaced atomically — across filesystems we fall back to
     * copy+unlink since `rename` returns EXDEV.
     */
    private async run(job: Job, signal: AbortSignal): Promise<void> {
        // Race-window safety: the file may have been exempted between
        // evaluate() (where we last checked) and now. Most common when
        // an operator toggles "Skip encoding" mid-upload — the queue
        // already has the job, but the sidecar just appeared.
        if (await isExempt(job.key)) {
            this.logger.info(`Skipping exempted file: ${job.key}`);
            return;
        }

        // Temp file extension matches the source so ffmpeg picks the
        // right output encoder (PNG→PNG, MP4→MP4, etc.). Without this
        // an image-input + .mp4-output would silently re-encode the
        // still as a 1-frame H.264 video.
        const ext = path.extname(job.key).toLowerCase() || '.mp4';
        const tmp = path.join(os.tmpdir(), `cg-encode-${process.pid}-${Date.now()}${ext}`);
        const started = Date.now();
        this.activeStartedAt = started;
        this.activeProgressMs = 0;
        this.lastProgressBroadcastAt = 0;
        // First broadcast carries the new "active" state so the UI shows
        // the bar even before ffmpeg has emitted a single progress line.
        this.broadcastState();

        const fail = async (error: Error) => {
            await noTryAsync(() => fs.unlink(tmp));
            const prev = this.state.get(job.hash);
            this.state.set(job.hash, {
                attempts: (prev?.attempts ?? 0) + 1,
                lastAttemptAt: Date.now(),
                lastError: error.message,
                completed: false,
            });
            this.pushHistory({
                path: job.key,
                success: false,
                durationMs: Date.now() - started,
                completedAt: Date.now(),
                error: error.message,
            });
            this.logger.warn(`Encode failed for ${job.key}: ${error.message}`);
        };

        // Image encode is much cheaper and emits no progress, so we
        // skip the onProgress wiring entirely for that path.
        const [encErr] = await noTryAsync(() => (job.kind === 'image'
            ? encodeImage({ input: job.key, output: tmp, signal })
            : encode({
                input: job.key,
                output: tmp,
                signal,
                onProgress: (ms) => {
                    this.activeProgressMs = ms;
                    this.broadcastProgress();
                },
            })
        ));

        if (signal.aborted) {
            await noTryAsync(() => fs.unlink(tmp));
            return;
        }

        if (encErr) {
            await fail(encErr as Error);
            return;
        }

        // Source-still-the-same check: if the file was touched while
        // we were encoding (mtime/size changed) the encoded result is
        // for stale content. Discard rather than overwrite the newer
        // version on disk.
        //
        // Compare against `mtime.getTime()` (integer ms, matching how
        // the scanner stored `mediaTime`) rather than `mtimeMs` —
        // ext4/APFS report sub-ms fractional values on the latter
        // which would never compare equal to the integer mtime.
        const [statErr, stat] = await noTryAsync(() => fs.stat(job.key));
        if (statErr || !stat) {
            await fail(new Error('source disappeared during encode'));
            return;
        }
        const statMtime = stat.mtime.getTime();
        if (stat.size !== job.size || statMtime !== job.mtime) {
            await noTryAsync(() => fs.unlink(tmp));
            this.logger.warn(`Source changed during encode, discarding: ${job.key}`);
            // Don't bump attempts — this is the user replacing the file,
            // not an encoder failure. Drop the old hash entry; the
            // scanner will rescan with the new content's hash.
            this.state.delete(job.hash);
            return;
        }

        // Atomic replace. EXDEV (cross-device link) falls back to a
        // copy then an unlink — same end state, just slower.
        const [renameErr] = await noTryAsync(() => fs.rename(tmp, job.key));
        if (renameErr && (renameErr as NodeJS.ErrnoException).code === 'EXDEV') {
            const [copyErr] = await noTryAsync(() => fs.copyFile(tmp, job.key));
            if (copyErr) {
                await fail(new Error(`copy across filesystems failed: ${copyErr.message}`));
                return;
            }
            await noTryAsync(() => fs.unlink(tmp));
        } else if (renameErr) {
            await fail(new Error(`rename failed: ${renameErr.message}`));
            return;
        }

        // The OLD hash is now stale — different bytes are on disk. Drop
        // it so we don't carry around an orphaned entry forever. The
        // scanner's rescan will compute the new hash and the next
        // evaluate() will see the metadata stamp and write a fresh
        // `completed: true` under the new key.
        this.state.delete(job.hash);

        const durationMs = Date.now() - started;
        this.pushHistory({
            path: job.key,
            success: true,
            durationMs,
            completedAt: Date.now(),
        });
        const seconds = Math.round(durationMs / 1000);
        this.logger.info(`Encoded ${job.key} → v${ENCODER_VERSION} in ${seconds}s`);
    }

    /** Doc id → file path, queried on demand so a recent removal still resolves. */
    private keyForDoc(id: string): string | null {
        return this.api.getFileDatabase().get(id)?.mediaPath ?? null;
    }

    /** Tear down our per-file footprint when a media doc is removed.
     *  Renames look like unlink + add to the scanner; we treat the
     *  sidecar specially so the exempt marker follows the file's
     *  content instead of vanishing with the old path. */
    private async handleRemoval(id: string) {
        const filePath = this.keyForDoc(id);
        if (!filePath) return;
        this.queue?.cancel(filePath);

        const db = this.api.getFileDatabase();
        const hash = db.getHash(id);
        if (hash) this.state?.delete(hash);

        const sidecar = `${filePath}.cgskip`;
        const [accessErr] = await noTryAsync(() => fs.access(sidecar));
        if (accessErr) return;             // nothing to follow

        // Add-first race: the rename's add event already arrived and
        // a new doc with the same hash is already in the DB. Move the
        // sidecar onto its path right now.
        if (hash) {
            const target = db.allDocs().find(
                (d) => d.id !== id && d.mediaPath !== filePath && db.getHash(d.id) === hash,
            );
            if (target?.mediaPath) {
                await noTryAsync(() => fs.rename(sidecar, `${target.mediaPath}.cgskip`));
                this.queue?.cancel(target.mediaPath);
                return;
            }
            // Otherwise park the sidecar; `evaluate()` will claim it
            // when (if) the add arrives within the limbo TTL.
            this.limbo.hold(hash, sidecar);
            return;
        }

        // No hash available — can't correlate, just drop the marker.
        await noTryAsync(() => fs.unlink(sidecar));
    }
}
