import crypto from 'crypto';
import config from '../util/config';

const COOKIE_NAME = 'cg-session';
// Stateless signed tokens survive restarts; re-issued once past half their lifetime.
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const FAILED_LOGIN_DELAY_MS = 250;

class AuthManagerImpl {
    get enabled(): boolean {
        return (
            (typeof config.password === 'string' &&
                config.password.length > 0) ||
            (typeof config['api-token'] === 'string' &&
                config['api-token'].length > 0)
        );
    }

    /** Constant-time compare so timing cannot leak the password length or prefix. */
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

    verifyApiToken(authHeader: string | undefined): boolean {
        const token = config['api-token'];
        if (typeof token !== 'string' || token.length === 0) return false;
        if (!authHeader?.startsWith('Bearer ')) return false;
        const candidate = authHeader.slice(7);
        const a = Buffer.from(candidate);
        const b = Buffer.from(token);
        return a.length === b.length && crypto.timingSafeEqual(a, b);
    }

    /** Stateless `<exp>.<hmac>`, keyed from the password so changing it invalidates sessions. */
    createSession(): string {
        return this.sign(Date.now() + SESSION_TTL_MS);
    }

    touch(token: string | undefined): boolean {
        return this.checkSession(token).authenticated;
    }

    /** One pass for validity and the sliding-window refresh cookie, avoiding a double verify. */
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

    /** Signing needs a password: with only an api-token the secret would derive from an empty string, so anyone could forge sessions. */
    private secret(): Buffer | undefined {
        if (typeof config.password !== 'string' || config.password.length === 0)
            return undefined;
        return crypto
            .createHash('sha256')
            .update(`cg-session:v1:${config.password}`)
            .digest();
    }

    private sign(exp: number): string {
        const secret = this.secret();
        if (!secret) throw new Error('sign() called without a password set');
        const hmac = crypto
            .createHmac('sha256', secret)
            .update(String(exp))
            .digest('hex');
        return `${exp}.${hmac}`;
    }

    /** Does not check expiry. */
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

    /** HttpOnly + SameSite=Lax; Path=/ so the WS upgrade sees the cookie. */
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
