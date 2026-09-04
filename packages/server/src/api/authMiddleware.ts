import type { Readable } from 'stream';
import {
    type MiddleWareData,
    MiddlewareProhibitFurtherExecution,
} from 'rest-exchange-protocol';
import { noTry } from 'no-try';
import { AuthManager } from './auth';

/** Buffer a JSON request body up to a sane cap; null on parse failure. */
async function readJsonBody(request: Readable): Promise<unknown> {
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
        request.on('data', (chunk: Buffer) => chunks.push(chunk));
        request.on('end', resolve);
        request.on('error', reject);
    });
    const text = Buffer.concat(chunks).toString('utf8');
    if (!text.trim()) return null;
    const [, parsed] = noTry(() => JSON.parse(text));
    return parsed ?? null;
}

/** Blocks /api/* and WS (excl. /_next/) when config.password is set. */
export function authMiddleware() {
    return async (data: MiddleWareData) => {
        if (!AuthManager.enabled) return;

        if (data.type === 'http') {
            const url = data.request.url ?? '';
            if (data.request.method === 'OPTIONS') return;

            const isProtected =
                url.startsWith('/api') || url.startsWith('/preview-whep');
            if (!isProtected) return;

            const token = AuthManager.readToken(data.request.headers.cookie);
            const session = AuthManager.checkSession(token);
            if (session.authenticated) {
                if (session.refresh)
                    data.response.setHeader('Set-Cookie', session.refresh);
                return;
            }
            if (AuthManager.verifyApiToken(data.request.headers.authorization))
                return;

            data.response.statusCode = 401;
            data.response.setHeader('Content-Type', 'application/json');
            data.response.end(JSON.stringify({ error: 'Unauthorized' }));
            throw new MiddlewareProhibitFurtherExecution();
        }

        if (data.type === 'websocket-upgrade') {
            const url = data.request.url ?? '';
            if (url.startsWith('/_next/')) return;

            const token = AuthManager.readToken(data.request.headers.cookie);
            if (AuthManager.touch(token)) return;
            if (AuthManager.verifyApiToken(data.request.headers.authorization))
                return;

            // No clean 401 path for WS upgrades — abort the socket.
            noTry(() => data.socket.destroy());
            throw new MiddlewareProhibitFurtherExecution();
        }
    };
}

/** Three endpoints, all under `/api/auth/`:
 *    POST /api/auth/login   — { password } → 200 + Set-Cookie | 401
 *    POST /api/auth/logout  — → 200 + cleared cookie
 *    GET  /api/auth/check   — → { enabled, authenticated } */
export function authApiMiddleware() {
    return async (data: MiddleWareData) => {
        if (data.type !== 'http') return;

        const url = data.request.url ?? '';
        if (!url.startsWith('/api/auth/')) return;

        const end = (status: number, body: object) => {
            data.response.statusCode = status;
            data.response.setHeader('Content-Type', 'application/json');
            data.response.end(JSON.stringify(body));
            throw new MiddlewareProhibitFurtherExecution();
        };

        if (url === '/api/auth/check' && data.request.method === 'GET') {
            const token = AuthManager.readToken(data.request.headers.cookie);
            end(200, {
                enabled: AuthManager.enabled,
                authenticated: !AuthManager.enabled || AuthManager.touch(token),
            });
            return;
        }

        if (url === '/api/auth/login' && data.request.method === 'POST') {
            const body = await readJsonBody(data.request);
            const password = (body as { password?: unknown } | null)?.password;
            if (!(await AuthManager.verifyPassword(password)))
                return end(401, { error: 'Invalid password' });

            const token = AuthManager.createSession();
            data.response.setHeader(
                'Set-Cookie',
                AuthManager.cookieHeader(token),
            );
            return end(200, { ok: true });
        }

        if (url === '/api/auth/logout' && data.request.method === 'POST') {
            data.response.setHeader(
                'Set-Cookie',
                AuthManager.clearCookieHeader(),
            );
            return end(200, { ok: true });
        }

        // Unknown /api/auth/* request — 404 so we don't fall through to
        // a route handler that would 404 anyway with worse messaging.
        return end(404, { error: 'Not found' });
    };
}
