import crypto from 'crypto';
import config from '../util/config';

const COOKIE_NAME = 'cg-session';
// Sliding-window expiry: every authenticated request updates `lastSeen`.
// Tokens unused for this long are dropped.
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
// Brute-force defence: failed logins block for this long. Cheap to hit on
// a single password setup, painful for anyone trying to guess.
const FAILED_LOGIN_DELAY_MS = 250;
const GC_INTERVAL_MS = 5 * 60 * 1000;

interface Session {
    lastSeen: number;
}

class AuthManagerImpl {
    private sessions = new Map<string, Session>();

    constructor() {
        // GC loop. `unref()` so it doesn't keep the process alive on exit.
        setInterval(() => this.gc(), GC_INTERVAL_MS).unref();
    }

    /** Whether auth is configured. When false, all requests are allowed
     *  through — preserves the pre-auth open behavior. */
    get enabled(): boolean {
        return typeof config.password === 'string' && config.password.length > 0;
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

    createSession(): string {
        const token = crypto.randomBytes(32).toString('hex');
        this.sessions.set(token, {lastSeen: Date.now()});
        return token;
    }

    /** Validate a token from a cookie. Touches `lastSeen` on success so
     *  active sessions don't time out. */
    touch(token: string | undefined): boolean {
        if (!token) return false;
        const session = this.sessions.get(token);
        if (!session) return false;
        if (Date.now() - session.lastSeen > SESSION_TTL_MS) {
            this.sessions.delete(token);
            return false;
        }
        session.lastSeen = Date.now();
        return true;
    }

    invalidate(token: string | undefined): void {
        if (token) this.sessions.delete(token);
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

    private gc() {
        const now = Date.now();
        for (const [token, session] of this.sessions)
            if (now - session.lastSeen > SESSION_TTL_MS) this.sessions.delete(token);
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

export const AuthManager = new AuthManagerImpl();
export {COOKIE_NAME as AUTH_COOKIE_NAME};
