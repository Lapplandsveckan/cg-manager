/** How a URL prefix is credentialed.
 *
 *  `public` — no credential. `session` — cookie or bearer api-token.
 *  `share-token` — an unguessable token in the path, checked by `shareTokenCheck`;
 *  the point is letting a guest share their screen without the manager password.
 *
 *  Access control used to be spread between a substring test here, a separate
 *  `/api/auth/*` middleware and several middlewares registered before the gate
 *  purely so they'd land pre-login. Every surface is now stated in this table,
 *  including the ones that fall through to `public`, so reachability is a table
 *  edit rather than a consequence of middleware registration order. */
import { noTry } from 'no-try';

export type AuthPolicy = 'public' | 'session' | 'share-token';

interface PolicyEntry {
    prefix: string;
    policy: AuthPolicy;
}

// First match wins, so the specific entries have to precede the broad ones.
const POLICIES: PolicyEntry[] = [
    // authApiMiddleware terminates every /api/auth/* request (unknown ones
    // included, via its 404) and needs to answer a login that has no session yet.
    { prefix: '/api/auth/', policy: 'public' },
    { prefix: '/api/public/ingest/', policy: 'share-token' },
    { prefix: '/api', policy: 'session' },
    { prefix: '/preview-whep', policy: 'session' },
    { prefix: '/ingest-whip', policy: 'session' },

    // Pre-login by design: the telemetry bootstrap, and the branding the login
    // page itself renders.
    { prefix: '/telemetry.js', policy: 'public' },
    { prefix: '/brand.js', policy: 'public' },

    // The Next app. Its pages render pre-login (the client redirects to
    // /login) and everything they read goes through the gated prefixes above.
    { prefix: '/', policy: 'public' },
];

/** Plugin-owned prefixes, from `registerRoute`/`registerHttpHandler`. Searched
 *  before the table: a plugin can only ever name a path under its own
 *  `/api/plugin[-http]/<name>/`, which is more specific than any entry there. */
const registered: PolicyEntry[] = [];

const longestFirst = (a: PolicyEntry, b: PolicyEntry) =>
    b.prefix.length - a.prefix.length;

export function registerPolicy(prefix: string, policy: AuthPolicy): () => void {
    const entry = { prefix, policy };
    registered.push(entry);
    registered.sort(longestFirst);

    return () => {
        const index = registered.indexOf(entry);
        if (index >= 0) registered.splice(index, 1);
    };
}

/** Node passes an absolute-form request target (`GET http://host/api/x`)
 *  through verbatim, and `//api/x` reaches us as-is too, while REP normalises
 *  both before matching routes. Matching raw prefixes would therefore put a
 *  non-canonical target in the `public` bucket, so canonicalise first. */
export function pathOf(url: string): string {
    // Leading slashes first: `new URL('//api/x', base)` reads `api` as the
    // *host*, so the collapse below would never see that path at all.
    const target = url.replace(/^\/{2,}/, '/');
    const [, parsed] = noTry(
        () => new URL(target, 'http://localhost').pathname,
    );

    return (parsed ?? target.split('?')[0]).replace(/\/{2,}/g, '/');
}

export function policyFor(url: string): AuthPolicy {
    const path = pathOf(url);
    const match = [...registered, ...POLICIES].find(entry =>
        path.startsWith(entry.prefix),
    );

    return match?.policy ?? 'session';
}

type ShareTokenCheck = (token: string) => boolean;

let shareTokenCheck: ShareTokenCheck = () => false;

/** Registered by the ingest manager; until then every share token is rejected. */
export function setShareTokenCheck(check: ShareTokenCheck): void {
    shareTokenCheck = check;
}

/** `/api/public/ingest/<token>[/...]` — the token is the whole credential. */
export function verifyShareToken(url: string): boolean {
    const token = pathOf(url).split('/')[4] ?? '';

    return !!token && shareTokenCheck(token);
}
