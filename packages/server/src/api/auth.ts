import crypto from 'crypto';
import config from '../util/config';

const COOKIE_NAME = 'cg-session';
// Sliding-window expiry: tokens are re-issued with a fresh expiry once past
// the halfway point of their lifetime (see `checkSession`). Tokens are
// stateless (signed, not stored), so they survive a server restart.
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
// Brute-force defence: failed logins block for this long. Cheap to hit on
// a single password setup, painful for anyone trying to guess.
const FAILED_LOGIN_DELAY_MS = 250;

class AuthManagerImpl {
    /** Whether auth is configured. When false, all requests are allowed
     *  through — preserves the pre-auth open behavior. */
    get enabled(): boolean {
        return (
            (typeof config.password === 'string' &&
                config.password.length > 0) ||
            (typeof config['api-token'] === 'string' &&
                config['api-token'].length > 0)
        );
    }

    /** Compare a candidate password against the configured one in constant
     *  time so timing channels can't leak the password length / prefix.
     *  Returns false fast when auth is disabled (no password to match). */
    async verifyPassword(candidate: unknown): Promise<boolean> {
        if (!this.enabled || typeof candidate !== 'string') {
            await this.delay(FAILED_LOGIN_DELAY_MS);
            return false;
        }

        const a = Buffer.from(candidate);
        const b = Buffer.from(config.password as string);
        const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
        if (!ok) await this.delay(FAILED_LOGIN_DELAY_MS);
        return ok;
    }

    /** Check an `Authorization: Bearer <token>` header value against the
     *  configured `api-token`. Returns false immediately when no token is
     *  configured so the cookie path still works in that case. */
    verifyApiToken(authHeader: string | undefined): boolean {
        const token = config['api-token'];
        if (typeof token !== 'string' || token.length === 0) return false;
        if (!authHeader?.startsWith('Bearer ')) return false;
        const candidate = authHeader.slice(7);
        const a = Buffer.from(candidate);
        const b = Buffer.from(token);
        return a.length === b.length && crypto.timingSafeEqual(a, b);
    }

    /** Stateless signed session token: `<exp>.<hmac>`. No server-side store,
     *  so validity survives a restart. Signed with a secret derived from the
     *  configured password, so changing the password invalidates sessions. */
    createSession(): string {
        return this.sign(Date.now() + SESSION_TTL_MS);
    }

    /** Validate a token: signature must match and it must not be expired. */
    touch(token: string | undefined): boolean {
        return this.checkSession(token).authenticated;
    }

    /** Single verification pass covering both whether a token is valid and,
     *  if so, whether it's past the halfway point of its lifetime and due
     *  for a sliding-window refresh (`refresh` holds the new Set-Cookie
     *  value in that case). Callers that need both should use this directly
     *  instead of `touch`+`refreshedCookie`, which would verify twice. */
    checkSession(token: string | undefined): {
        authenticated: boolean;
        refresh?: string;
    } {
        const exp = this.verify(token);
        if (exp === undefined || exp <= Date.now())
            return { authenticated: false };
        const remaining = exp - Date.now();
        const refresh =
            remaining <= SESSION_TTL_MS / 2
                ? this.cookieHeader(this.createSession())
                : undefined;
        return { authenticated: true, refresh };
    }

    /** Cookie sessions can only be minted via `verifyPassword`, so signing
     *  requires a configured password. Without this guard, an `api-token`
     *  -only deployment (no password) would derive the secret from an empty
     *  string — a value anyone can compute, forging valid sessions. */
    private secret(): Buffer | undefined {
        if (typeof config.password !== 'string' || config.password.length === 0)
            return undefined;
        return crypto
            .createHash('sha256')
            .update(`cg-session:v1:${config.password}`)
            .digest();
    }

    /** Only called after `verifyPassword` succeeds, so a password is always
     *  configured here. */
    private sign(exp: number): string {
        const secret = this.secret();
        if (!secret) throw new Error('sign() called without a password set');
        const hmac = crypto
            .createHmac('sha256', secret)
            .update(String(exp))
            .digest('hex');
        return `${exp}.${hmac}`;
    }

    /** Returns the token's expiry timestamp if the signature is valid,
     *  otherwise undefined. Does not check expiry itself. */
    private verify(token: string | undefined): number | undefined {
        const secret = this.secret();
        if (!secret || !token) return undefined;
        const [expPart, hmacPart] = token.split('.');
        if (!expPart || !hmacPart) return undefined;
        const exp = Number(expPart);
        if (!Number.isFinite(exp)) return undefined;

        const expected = crypto
            .createHmac('sha256', secret)
            .update(expPart)
            .digest('hex');
        const a = Buffer.from(hmacPart);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b))
            return undefined;
        return exp;
    }

    /** Build the `Set-Cookie` header value for a session. HttpOnly so JS
     *  can't read it (mitigates XSS exfil); SameSite=Lax for casual CSRF
     *  protection. Path=/ so the WS upgrade sees it too. */
    cookieHeader(token: string): string {
        const maxAgeSeconds = Math.floor(SESSION_TTL_MS / 1000);
        return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
    }

    clearCookieHeader(): string {
        return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
    }

    readToken(cookieHeader: string | undefined): string | undefined {
        if (!cookieHeader) return undefined;
        for (const part of cookieHeader.split(';')) {
            const [k, ...rest] = part.trim().split('=');
            if (k === COOKIE_NAME) return rest.join('=');
        }
        return undefined;
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export const AuthManager = new AuthManagerImpl();
export { COOKIE_NAME as AUTH_COOKIE_NAME };
