// `/light`: the full package pulls in OpenTelemetry modules, one of which does
// import('node:inspector'), which is fatal inside the pkg snapshot.
import * as Sentry from '@sentry/node-core/light';
import { noTry } from 'no-try';
// `./_config`, not `./config`: this loads before loadConfig(); deepAssign mutates the same object.
// Consequence: readConfigFile errors cannot reach Sentry, since the DSN comes from that config.
import config from './_config';
import { LogLevel, setLogHook } from './log';
import { isAmcpError } from './amcpError';
import { version } from './version';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
let recentEventTimestamps: number[] = [];

/** Caps events per minute, mirroring CasparExecutor's bounce breaker. */
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

/** Checked before the rate limiter so a repeating failure cannot spend the budget. */
function isRepeat(key: string): boolean {
    const now = Date.now();
    const repeat =
        lastCapturedKey === key && now - lastCapturedAt < DEDUPE_WINDOW_MS;
    lastCapturedKey = key;
    lastCapturedAt = now;
    return repeat;
}

/** Matches the string amcpError formats; the original Error is gone once it reaches Logger. */
const AMCP_CODE_PATTERN = /^(?:\([^)]*\) )*CasparResponseError \((-?\d+)\)/;

function extractAmcpCode(message: string): number | null {
    const match = message.match(AMCP_CODE_PATTERN);
    return match ? Number(match[1]) : null;
}

/** -1 is timeout/disconnect (50+ per restart); 4xx is routine. Unclassifiable codes are sent. */
function isNoisyAmcpCode(code: number): boolean {
    return code === -1 || (code >= 400 && code < 500);
}

/** Continuous chatter (CasparCG stderr, probe 'not media') that would exhaust the rate limit. */
const NOISY_MESSAGE_PATTERNS = [
    /^\(CasparCG\) /,
    /Exception Error \(not media\)/,
    /Info Failed$/,
    /Thumbnail Failed$/,
    // captureClientError is the real event; this drops the duplicate string event but keeps the breadcrumb.
    /^\(WebClient\) /,
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

// Logger's 4096 cap does not apply to direct Logger.* calls.
const BREADCRUMB_MESSAGE_LIMIT = 500;
const truncateForBreadcrumb = (message: string): string =>
    message.length > BREADCRUMB_MESSAGE_LIMIT
        ? `${message.slice(0, BREADCRUMB_MESSAGE_LIMIT)} … [truncated]`
        : message;

/** Transport failures loop back via the Console scope after the inHook guard resets; matched narrowly to keep real console.error. */
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

export interface ClientErrorReport {
    source: string;
    message: string;
    stack?: string;
    componentStack?: string;
    url?: string;
}

// Untrusted input (the endpoint may be unauthenticated): capped and routed through the shared rate limiter.
const CLIENT_ERROR_FIELD_LIMIT = 2000;
const truncateClientField = (value: string): string =>
    value.length > CLIENT_ERROR_FIELD_LIMIT
        ? value.slice(0, CLIENT_ERROR_FIELD_LIMIT)
        : value;

export function captureClientError(report: ClientErrorReport): void {
    if (!initialized) return;
    const message = truncateClientField(report.message);
    if (isRepeat(`client:${report.source}:${message}`)) return;
    if (!withinRateLimit()) return;

    noTry(() => {
        const error = new Error(message);
        if (report.stack) error.stack = truncateClientField(report.stack);
        // Not clearBreadcrumbs: addBreadcrumb writes to the isolation scope, so beforeSend strips them.
        Sentry.withScope(scope => {
            scope.setTag('origin', 'browser');
            scope.setTag('source', report.source);
            if (report.componentStack)
                scope.setExtra(
                    'componentStack',
                    truncateClientField(report.componentStack),
                );
            if (report.url) scope.setExtra('url', report.url);
            Sentry.captureException(error);
        });
    });
}

/** Never throws: it runs on the live AMCP stream, where a throw would corrupt the transport. */
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

// Call after loadConfig(), before anything that can throw at startup.
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
        // Opt-in only: index.ts owns the uncaught handlers; contextLines/localVariables/modules
        // break in the pkg snapshot; console and childProcess are noise or recursion.
        defaultIntegrations: false,
        integrations: [Sentry.dedupeIntegration()],
        maxBreadcrumbs: 100,
        debug: false,
        // Browser crashes carry no relevant AMCP/log trail; stripped per event (see captureClientError).
        beforeSend(event) {
            if (event.tags?.origin === 'browser') event.breadcrumbs = [];
            return event;
        },
    });

    setLogHook(handleLog);
}

export async function flushTelemetry(timeoutMs = 2000): Promise<void> {
    if (!initialized) return;
    setLogHook(null);
    await Sentry.flush(timeoutMs);
}
