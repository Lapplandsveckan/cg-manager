/** How a URL prefix is credentialed.
 *
 *  `public` — no credential. `session` — cookie or bearer api-token.
 *  `share-token` — an unguessable token in the path, checked by `shareTokenCheck`;
 *  the point is letting a guest share their screen without the manager password.
 *
 *  Access control used to be spread between a substring test here, a separate
 *  `/api/auth/*` middleware and several middlewares registered before the gate
 *  purely so they'd land pre-login. This table is the one place it lives now;
 *  the pre-gate middlewares stay where they are, but their reachability is
 *  stated here rather than implied by registration order. */
import { noTry } from 'no-try';

export type AuthPolicy = 'public' | 'session' | 'share-token';

interface PolicyEntry {
    prefix: string;
    policy: AuthPolicy;
}

// First match wins, so the specific entries have to precede the broad ones.
const POLICIES: PolicyEntry[] = [
    // Unreachable by construction: authApiMiddleware terminates every
    // /api/auth/* request (unknown ones included, via its 404) before the gate
    // runs. Listed so narrowing that prefix can't silently expose anything.
    { prefix: '/api/auth/', policy: 'public' },
    { prefix: '/api/public/ingest/', policy: 'share-token' },
    { prefix: '/api', policy: 'session' },
    { prefix: '/preview-whep', policy: 'session' },
    { prefix: '/ingest-whip', policy: 'session' },
];

/** Node passes an absolute-form request target (`GET http://host/api/x`)
 *  through verbatim, and `//api/x` reaches us as-is too, while REP normalises
 *  both before matching routes. Matching raw prefixes would therefore put a
 *  non-canonical target in the `public` bucket, so canonicalise first. */
export function pathOf(url: string): string {
    const [, parsed] = noTry(() => new URL(url, 'http://localhost').pathname);

    return (parsed ?? url.split('?')[0]).replace(/\/{2,}/g, '/');
}

export function policyFor(url: string): AuthPolicy {
    const path = pathOf(url);
    const match = POLICIES.find(entry => path.startsWith(entry.prefix));

    return match?.policy ?? 'public';
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
