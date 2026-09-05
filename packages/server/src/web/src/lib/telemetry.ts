import * as Sentry from '@sentry/react';

export interface BrowserTelemetryConfig {
    dsn: string | null;
    environment: string;
    release: string;
    replays: boolean;
    sampleRate: number;
}

declare global {
    interface Window {
        // Set by the runtime-generated `/telemetry.js` (see
        // `src/api/telemetryScript.ts`) — config.json is read at server
        // runtime but `next build` runs at packaging time, so this can't be
        // baked in as a `NEXT_PUBLIC_*` env var. `_document.tsx` loads the
        // script before the app bundle so it's set before this module runs.
        __CG_TELEMETRY__?: BrowserTelemetryConfig;
    }
}

let initialized = false;

/** No-op when the DSN is unset (the default) — matches the server-side
 *  `initTelemetry()`'s zero-behaviour-change contract. Call once, at module
 *  scope in `_app.tsx`, before the first render — `@sentry/react`'s default
 *  integrations (`window.onerror`, `unhandledrejection`, breadcrumbs) only
 *  cover what happens after `init()` runs. */
export function initBrowserTelemetry(): void {
    if (typeof window === 'undefined' || initialized) return;
    const telemetry = window.__CG_TELEMETRY__;
    if (!telemetry?.dsn) return;
    initialized = true;

    Sentry.init({
        dsn: telemetry.dsn,
        environment: telemetry.environment,
        release: telemetry.release,
        sampleRate: telemetry.sampleRate,
        tracesSampleRate: 0,
        // Replay is unmasked by design (see CLAUDE.md's telemetry section) —
        // the point is seeing what an operator actually did before a crash,
        // not a redacted approximation of it. Session recording is off
        // (`replaysSessionSampleRate: 0`); only a crash captures one.
        integrations: telemetry.replays
            ? [
                  Sentry.replayIntegration({
                      maskAllText: false,
                      blockAllMedia: false,
                  }),
              ]
            : [],
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: telemetry.replays ? 1.0 : 0,
    });
}
