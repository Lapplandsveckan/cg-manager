// `@sentry/node-core` (full) drags ~40 unconditional OpenTelemetry
// instrumentation modules into its require graph before `init()` ever runs —
// one of them does `await import('node:inspector')`, which is fatal inside
// the pkg snapshot (see .lappis/scripts/package.js's other vm-import
// patches). The `/light` entrypoint has zero `@opentelemetry/*` requires:
// error tracking, breadcrumbs and release/environment tagging, no tracing.
import * as Sentry from '@sentry/node-core/light';
// `./_config`, not `./config` — this file is imported from `index.ts` before
// `loadConfig()` has necessarily run in every code path, and `_config.ts` is
// the leaf defaults module (same pattern as
// `manager/caspar/config/profiles.ts`). `loadConfig()`'s `deepAssign` mutates
// this same object in place, so reading `config.telemetry` here always sees
// the current value regardless of import order. One consequence: the two
// `Logger.error` calls inside `readConfigFile` (config read/parse failure)
// can never reach Sentry, since the DSN itself comes from that same config —
// unavoidable without a second, env-var-only bootstrap path, which isn't
// worth it for a failure this rare.
import { noTry } from 'no-try';
import config from './_config';
import { LogLevel, setLogHook } from './log';
import { isAmcpError } from './amcpError';
import { version } from './version';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
let recentEventTimestamps: number[] = [];

/** Circuit breaker mirroring `CasparExecutor`'s `BOUNCE_MAX`/`BOUNCE_WINDOW_MS`
 *  pattern — caps events/minute so a failure loop (including the transport
 *  itself failing) can't burn through the Sentry quota. */
function withinRateLimit(): boolean {
    const now = Date.now();
    recentEventTimestamps = recentEventTimestamps.filter(
        t => now - t < RATE_LIMIT_WINDOW_MS,
    );
    if (recentEventTimestamps.length >= RATE_LIMIT_MAX) return false;
    recentEventTimestamps.push(now);
    return true;
}

const DEDUPE_WINDOW_MS = 5_000;
let lastCapturedKey: string | null = null;
let lastCapturedAt = 0;

/** Short-window repeat suppression, checked *before* the rate limiter
 *  consumes a slot. `Sentry.dedupeIntegration()` alone isn't enough here —
 *  it decides after an event is already built, which is after this module's
 *  own rate limit has already spent a slot on it. A tight retry loop
 *  logging the same failure every tick would otherwise exhaust the 20/min
 *  budget sending one message over and over. */
function isRepeat(key: string): boolean {
    const now = Date.now();
    const repeat =
        lastCapturedKey === key && now - lastCapturedAt < DEDUPE_WINDOW_MS;
    lastCapturedKey = key;
    lastCapturedAt = now;
    return repeat;
}

/** Matches the `"CasparResponseError (<code>): ..."` shape that
 *  `src/util/amcpError.ts`'s `formatError` produces — by the time an AMCP
 *  disconnect rejection reaches `Logger.error` via `index.ts`'s
 *  `unhandledRejection` handler, it has already been flattened to this
 *  string and the original `Error` is gone. Anchored (allowing leading scope
 *  prefixes like `(AMCP) `) so a message that merely *mentions* an AMCP code
 *  in passing doesn't get misclassified. */
const AMCP_CODE_PATTERN = /^(?:\([^)]*\) )*CasparResponseError \((-?\d+)\)/;

function extractAmcpCode(message: string): number | null {
    const match = message.match(AMCP_CODE_PATTERN);
    return match ? Number(match[1]) : null;
}

/** -1 is a timeout/disconnect rejection (one fires per pending command on
 *  every CasparCG restart — a single restart can reject 50+ at once); 4xx is
 *  a routine protocol error (missing media/template, bad parameter). 5xx
 *  (a genuine server-side failure) is not noise. An AMCP error with no
 *  numeric code at all is unfamiliar shape, not a known-routine one — default
 *  to sending it rather than silently dropping something we can't classify. */
function isNoisyAmcpCode(code: number): boolean {
    return code === -1 || (code >= 400 && code < 500);
}

/** Everything below is continuous, expected chatter on any real install —
 *  not filtering these would exhaust the rate limit within seconds and
 *  starve genuine errors for the rest of the window:
 *   - CasparCG's raw stderr, piped through `Logger.error` by
 *     `manager/caspar/process.ts` for every line the process prints.
 *   - `probe.ts`'s `new Error('not media')`, which the scanner logs for
 *     every non-probeable file (sidecar files, `.cgnoencode` markers, text
 *     files) it walks — routine on any populated media folder. */
const NOISY_MESSAGE_PATTERNS = [
    /^\(CasparCG\) /,
    /Exception Error \(not media\)/,
    /Info Failed$/,
    /Thumbnail Failed$/,
];

function isNoisyEvent(message: string, error?: Error): boolean {
    if (error && isAmcpError(error)) {
        const code = (error as { code?: number }).code;
        return typeof code === 'number' && isNoisyAmcpCode(code);
    }
    const amcpCode = extractAmcpCode(message);
    if (amcpCode !== null) return isNoisyAmcpCode(amcpCode);
    return NOISY_MESSAGE_PATTERNS.some(pattern => pattern.test(message));
}

const breadcrumbLevel = (level: LogLevel): Sentry.SeverityLevel => {
    if (level === LogLevel.WARN) return 'warning';
    if (level === LogLevel.DEBUG) return 'debug';
    if (level === LogLevel.ERROR || level === LogLevel.FATAL) return 'error';
    return 'info';
};

// Full stacks (via `Logger.error(someError)` → `Exception ... stack: ...`)
// would otherwise sit in the 100-entry breadcrumb ring uncapped — `Logger`'s
// own 4096-char cap only applies to intercepted `console.*` output, not
// `Logger.*` calls directly.
const BREADCRUMB_MESSAGE_LIMIT = 500;
const truncateForBreadcrumb = (message: string): string =>
    message.length > BREADCRUMB_MESSAGE_LIMIT
        ? `${message.slice(0, BREADCRUMB_MESSAGE_LIMIT)} … [truncated]`
        : message;

/** A transport failure that logs via `console.error` (network error,
 *  self-diagnostic) gets routed back here through `Logger`'s console
 *  interception under the `Console` scope — the one edge a failure can loop
 *  back through async, after `log.ts`'s synchronous `inHook` guard has
 *  already reset. Narrowly matched (not a blanket `Console`-scope drop) so a
 *  plugin or library's real `console.error` still reaches Sentry. */
const isTelemetryTransportNoise = (message: string): boolean =>
    message.startsWith('(Console) ') && /sentry/i.test(message);

function handleLog(level: LogLevel, message: string, error?: Error): void {
    if (isTelemetryTransportNoise(message)) return;

    if (level !== LogLevel.ERROR && level !== LogLevel.FATAL) {
        Sentry.addBreadcrumb({
            category: 'log',
            level: breadcrumbLevel(level),
            message: truncateForBreadcrumb(message),
        });
        return;
    }

    Sentry.addBreadcrumb({
        category: 'log',
        level: 'error',
        message: truncateForBreadcrumb(message),
    });
    if (isNoisyEvent(message, error)) return;
    if (isRepeat(error ? `${error.name}:${error.message}` : message)) return;
    if (!withinRateLimit()) return;

    if (error) {
        Sentry.captureException(error);
        return;
    }
    Sentry.captureMessage(message, 'error');
}

let initialized = false;

/** Records an AMCP command-trail entry as a breadcrumb — never an event.
 *  `CasparExecutor` calls this directly (not through `Logger`, hence not
 *  through `fireHook`'s re-entrancy guard) from inside `send()`/`receive()`
 *  on the live AMCP stream — a throw here must never propagate: in `send()`
 *  it would skip clearing the retry buffer and cause already-transmitted
 *  commands to be resent; in `receive()`'s `this.responseBuffer =
 *  this.receive(...)` it would drop the just-arrived chunk and desync the
 *  stream until the next reconnect. `noTry` guarantees telemetry can never
 *  corrupt the transport it's observing. No-ops when telemetry isn't
 *  initialised, so callers don't need to guard themselves. */
export function breadcrumbAmcp(
    message: string,
    level: Sentry.SeverityLevel = 'info',
): void {
    if (!initialized) return;
    noTry(() =>
        Sentry.addBreadcrumb({
            category: 'amcp',
            level,
            message: truncateForBreadcrumb(message),
        }),
    );
}

/** No-op when `telemetry.dsn` is unset (the default) — nothing initialises
 *  and there is zero behaviour change for installs that never configure it.
 *  Call once, after `loadConfig()` so `config.telemetry` reflects config.json
 *  overrides, and before anything that might throw during startup. */
export function initTelemetry(): void {
    const dsn = config.telemetry?.dsn;
    if (!dsn || initialized) return;
    initialized = true;

    Sentry.init({
        dsn,
        environment: config.telemetry.environment,
        release: `cg-manager@${version}`,
        sampleRate: config.telemetry['sample-rate'],
        tracesSampleRate: 0,
        // Opt-in only. In particular: no `onUncaughtException`/
        // `onUnhandledRejection` — `index.ts` already owns both and
        // deliberately absorbs AMCP errors in prod; Sentry's defaults would
        // double-report and change exit behaviour. No `contextLines` (reads
        // source off disk — inside the pkg snapshot that's `/snapshot/...`).
        // No `localVariables` (`await import('node:inspector')`, pkg-fatal).
        // No `modules` (walks node_modules off disk — meaningless in a
        // snapshot). No `childProcess` (we spawn CasparCG constantly — pure
        // noise). No `console` (would fight the interception in `log.ts`
        // and recreate the recursion loop this module guards against).
        defaultIntegrations: false,
        integrations: [Sentry.dedupeIntegration()],
        maxBreadcrumbs: 100,
        debug: false,
    });

    setLogHook(handleLog);
}

/** Flushes any pending events before the process exits. Safe to call even
 *  when telemetry was never initialised. Unregisters the log hook first so
 *  anything logged during shutdown itself (after this call starts) isn't
 *  queued into a client that's about to stop accepting events. */
export async function flushTelemetry(timeoutMs = 2000): Promise<void> {
    if (!initialized) return;
    setLogHook(null);
    await Sentry.flush(timeoutMs);
}
