import {
    type MiddleWareData,
    MiddlewareProhibitFurtherExecution,
} from 'rest-exchange-protocol';
import config from '../util/config';
import { version } from '../util/version';

/** Serves `GET /telemetry.js` — a runtime-generated script exposing the
 *  Sentry config to the browser. `config.json` is read at server runtime but
 *  `next build` runs at packaging time, so the DSN can't be baked in as a
 *  `NEXT_PUBLIC_*` env var; this is the workaround.
 *
 *  Deliberately not under `/api` — `_document.tsx` loads it before the app
 *  bundle, and `auth()` only gates `/api` and `/preview-whep`, so this is
 *  reachable pre-login. That's the point: it's the only way a login-page
 *  crash could ever reach Sentry, since `/api/log/client` (the browser
 *  error-report path) sits behind auth. */
export function telemetryScriptMiddleware() {
    return async (data: MiddleWareData) => {
        if (data.type !== 'http') return;
        if (!/^\/telemetry\.js(?:\?.*)?$/.test(data.request.url)) return;
        if (data.request.method !== 'GET') return;

        const payload = {
            dsn: config.telemetry?.dsn ?? null,
            environment: config.telemetry?.environment ?? 'production',
            release: `cg-manager@${version}`,
            replays: config.telemetry?.replays ?? true,
            sampleRate: config.telemetry?.['sample-rate'] ?? 1,
        };

        data.response.statusCode = 200;
        data.response.setHeader(
            'Content-Type',
            'application/javascript; charset=utf-8',
        );
        data.response.setHeader('X-Content-Type-Options', 'nosniff');
        // Without this an operator changing the DSN gets a stale script
        // (and therefore a stale/no telemetry config) indefinitely.
        data.response.setHeader('Cache-Control', 'no-store');
        data.response.end(
            `window.__CG_TELEMETRY__ = ${JSON.stringify(payload)};`,
        );

        throw new MiddlewareProhibitFurtherExecution();
    };
}
