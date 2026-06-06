import {
    type Client,
    type Method, type MiddleWareData,
    MiddlewareProhibitFurtherExecution,
    REPServer,
    type TypedClient,
    WebsocketClient, WebsocketOutboundMethod,
} from 'rest-exchange-protocol';
import {type Route} from 'rest-exchange-protocol/dist/route';
import {noTry, noTryAsync} from 'no-try';
import {loadRoutes} from './route';
import {type CasparManager} from '../manager';
import {handleRequest, onUpgrade} from '../web';
import {Logger} from '../util/log';
import {Upload} from '../manager/scanner/upload';
import {AuthManager} from './auth';
import {isInternalMediaId} from '../manager/scanner/folders';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type CGClient = TypedClient<{}>;

export class CGServer {
    private server: REPServer;
    private manager: CasparManager;

    constructor(manager: CasparManager, port?: number) {
        this.manager = manager;

        this.server = new REPServer({
            port,
        });

        const routes = loadRoutes();
        routes.forEach((route) => this.server.register(route));

        // this.server.use(this.log());

        // Ordering matters:
        //   cors      — must run first so the OPTIONS preflight short-circuits
        //               without needing a session cookie.
        //   auth      — gates everything else (REST + WS upgrade) when
        //               config.password is set. Login/logout/check are
        //               whitelisted, as are non-/api paths (Next.js pages
        //               like /login itself).
        //   authApi   — handles POST/GET /api/auth/{login,logout,check}.
        //               Must come after `auth` only because order is fine
        //               either way (auth() whitelists these paths).
        //   previewWhep — WHEP SDP exchange. Must run before web().
        //   upload      — chunked upload sink.
        //   web         — final fallback: hand everything non-/api to Next.js.
        this.server.use(this.cors());
        this.server.use(this.auth());
        this.server.use(this.authApi());
        this.server.use(this.previewWhep());
        this.server.use(this.upload());
        this.server.use(this.web());

        this.manager.on('caspar-status', (status) => {
            const clients = this.server.getClients();
            clients.forEach((client) => {
                if (!(client instanceof WebsocketClient)) return;
                client.send('caspar/status', WebsocketOutboundMethod.ACTION, status, false);
            });
        });

        this.manager.on('caspar-logs', (logs) => {
            const clients = this.server.getClients();
            clients.forEach((client) => {
                if (!(client instanceof WebsocketClient)) return;
                client.send('caspar/logs', WebsocketOutboundMethod.ACTION, logs, false);
            });
        });

        this.manager.on('media', (key, value) => {
            // Skip plugin-internal symlinks. They're scanner-only data and
            // shouldn't surface in the UI's media list.
            if (isInternalMediaId(key)) return;
            // Skip entries the scanner couldn't actually probe (sidecar
            // files, .txt etc). `value === null` is a removal — still
            // broadcast so clients drop their cached entry.
            if (value !== null && !(value as { mediainfo?: unknown })?.mediainfo) return;
            const clients = this.server.getClients();
            clients.forEach((client) => {
                if (!(client instanceof WebsocketClient)) return;
                client.send('caspar/media', WebsocketOutboundMethod.ACTION, { key, value }, false);
            });
        });

        // Running-config snapshot: emitted whenever CasparCG starts or stops.
        // Lets UI consumers (previews, routes) react to live capability
        // changes without polling /api/caspar/config/running.
        this.manager.on('caspar-running-config', (cfg) => {
            const clients = this.server.getClients();
            clients.forEach((client) => {
                if (!(client instanceof WebsocketClient)) return;
                client.send('caspar/running-config', WebsocketOutboundMethod.ACTION, cfg, false);
            });
        });

        // Video route mutations (create / update / delete) — forwarded so
        // clients can refresh without polling. UPDATE / CREATE carry the
        // full route; DELETE carries the id string.
        this.manager.on('route-change', ({method, data}: {
            method: 'CREATE' | 'UPDATE' | 'DELETE';
            data: unknown;
        }) => {
            this.broadcast('routes', WebsocketOutboundMethod[method], data);
        });
    }

    public broadcast<T>(target: string, method: WebsocketOutboundMethod, data: T, exclude?: Client) {
        const clients = this.server.getClients();
        clients.forEach((client) => {
            if (client === exclude || !(client instanceof WebsocketClient)) return;
            client.send(target, method, data, false);
        });
    }

    log() {
        return async (data: MiddleWareData) => {
            if (data.type !== 'pre-route') return;
            Logger.scope('API').debug(`${data.route.method} ${data.route.path}`);
        };
    }

    /** Gate every API request and WS upgrade behind a session cookie when
     *  `config.password` is set.
     *
     *  Public (no session needed):
     *    - /api/auth/*       — login/check/logout endpoints
     *    - OPTIONS *         — CORS preflight
     *    - non-/api HTTP     — Next.js pages, static assets, login UI
     *    - WS /_next/*       — Next.js HMR socket (dev only)
     *
     *  Protected:
     *    - /api/* HTTP        (REST routes + chunked upload)
     *    - /preview-whep/*    (WHEP SDP exchange — can spin up encoder)
     *    - all other WS upgrades (REP socket for state + commands)
     */
    auth() {
        return async (data: MiddleWareData) => {
            if (!AuthManager.enabled) return;

            if (data.type === 'http') {
                const url = data.request.url ?? '';
                if (url.startsWith('/api/auth/')) return;
                if (data.request.method === 'OPTIONS') return;

                const isProtected = url.startsWith('/api') || url.startsWith('/preview-whep');
                if (!isProtected) return;

                const token = AuthManager.readToken(data.request.headers.cookie);
                if (AuthManager.touch(token)) return;

                data.response.statusCode = 401;
                data.response.setHeader('Content-Type', 'application/json');
                data.response.end(JSON.stringify({error: 'Unauthorized'}));
                throw new MiddlewareProhibitFurtherExecution();
            }

            if (data.type === 'websocket-upgrade') {
                const url = data.request.url ?? '';
                if (url.startsWith('/_next/')) return;

                const token = AuthManager.readToken(data.request.headers.cookie);
                if (AuthManager.touch(token)) return;

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
    authApi() {
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
                const body = await this.readJsonBody(data.request);
                const password = (body as { password?: unknown } | null)?.password;
                if (!(await AuthManager.verifyPassword(password)))
                    return end(401, {error: 'Invalid password'});

                const token = AuthManager.createSession();
                data.response.setHeader('Set-Cookie', AuthManager.cookieHeader(token));
                return end(200, {ok: true});
            }

            if (url === '/api/auth/logout' && data.request.method === 'POST') {
                const token = AuthManager.readToken(data.request.headers.cookie);
                AuthManager.invalidate(token);
                data.response.setHeader('Set-Cookie', AuthManager.clearCookieHeader());
                return end(200, {ok: true});
            }

            // Unknown /api/auth/* request — 404 so we don't fall through to
            // a route handler that would 404 anyway with worse messaging.
            return end(404, {error: 'Not found'});
        };
    }

    /** Buffer a JSON request body up to a sane cap. Returns null on parse
     *  failure or empty body so handlers can early-out cleanly. */
    private async readJsonBody(request: any): Promise<unknown> {
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

    previewWhep() {
        // POST /preview-whep/:channel — WHEP-style SDP exchange. The browser
        // POSTs an SDP offer (Content-Type: application/sdp), we hand it to
        // PreviewManager.openWebRTC, and return 201 + SDP answer. The
        // resulting peer connection lives until the browser tab closes;
        // werift tears the underlying CasparCG consumer down via the
        // connectionStateChange subscription inside the session.
        //
        // No DELETE endpoint: ICE/DTLS state transitions handle teardown
        // automatically. The Location header is included per RFC 9725
        // so clients can target a DELETE if we add one later.
        return async (data: MiddleWareData) => {
            if (data.type !== 'http') return;

            const match = data.request.url.match(/^\/preview-whep\/(\d+)(?:\?.*)?$/);
            if (!match) return;

            if (data.request.method !== 'POST') {
                data.response.statusCode = 405;
                data.response.setHeader('Allow', 'POST');
                data.response.end('Method Not Allowed');
                throw new MiddlewareProhibitFurtherExecution();
            }

            const channel = parseInt(match[1], 10);
            if (!Number.isFinite(channel) || channel < 1) {
                data.response.statusCode = 400;
                data.response.end('Invalid channel');
                throw new MiddlewareProhibitFurtherExecution();
            }

            // Collect the SDP offer body.
            const chunks: Buffer[] = [];
            for await (const chunk of data.request as unknown as AsyncIterable<Buffer>) chunks.push(chunk);
            const sdpOffer = Buffer.concat(chunks).toString('utf8');
            if (!sdpOffer.trim()) {
                data.response.statusCode = 400;
                data.response.end('Empty SDP offer');
                throw new MiddlewareProhibitFurtherExecution();
            }

            const [err, session] = await noTryAsync(() =>
                this.manager.preview.openWebRTC({channel, sdpOffer}));
            if (err || !session) {
                Logger.scope('Preview').warn(`WHEP session failed: ${(err as Error)?.message}`);
                data.response.statusCode = 503;
                data.response.end((err as Error)?.message ?? 'Failed to open preview');
                throw new MiddlewareProhibitFurtherExecution();
            }

            data.response.statusCode = 201;
            data.response.setHeader('Content-Type', 'application/sdp');
            data.response.setHeader('Location', data.request.url);
            data.response.end(session.sdpAnswer);

            throw new MiddlewareProhibitFurtherExecution();
        };
    }

    upload() {
        return async (data: MiddleWareData) => {
            if (data.type !== 'http') return;
            if (!data.request.url.startsWith('/api/upload/chunk')) return;

            const answer = (status: number, message: string, stop = true) => {
                data.response.statusCode = status;
                data.response.write(message);
                data.response.end();

                if (stop) throw new MiddlewareProhibitFurtherExecution();
            };

            const url = new URL(data.request.url, `http://${data.request.headers.host}`);
            const id = url.searchParams.get('id')?.toString();
            if (!id) return answer(400, 'No id provided');

            const upload = Upload.get(id);
            if (!upload) return answer(404, 'Upload not found');

            const chunk = parseInt(url.searchParams.get('chunk'));
            if (Number.isNaN(chunk) || chunk < 0 || chunk >= upload['data'].total) return answer(400, 'Invalid chunk');

            const buffer: Uint8Array[] = [];
            data.request.on('data', (chunk) => buffer.push(chunk));
            data.request.on('end', () => {
                upload.bufferChunk(chunk, Buffer.concat(buffer));
                answer(200, 'OK', false);
            });

            throw new MiddlewareProhibitFurtherExecution();
        };
    }

    web() {
        return async data => {
            if (data.type === 'websocket-upgrade' && data.request.url.startsWith('/_next/')) {
                onUpgrade(data.request, data.socket, data.head);
                throw new MiddlewareProhibitFurtherExecution();
            }

            if (data.type !== 'http') return;
            if (data.request.url.startsWith('/api')) return;

            await handleRequest(data.request, data.response);
            throw new MiddlewareProhibitFurtherExecution();
        };
    }

    cors() {
        return data => {
            if (data.type !== 'http') return;

            data.response.setHeader('Access-Control-Allow-Origin', '*');
            data.response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
            data.response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Authentication');

            if (data.request.method !== 'OPTIONS') return;

            data.response.statusCode = 200;
            data.response.end();

            throw new MiddlewareProhibitFurtherExecution();
        };
    }

    async start() {
        await this.server.start();
    }

    async stop() {
        await this.server.stop();
    }

    public registerRoute(path: string, handler: Route['handler'], method: Method) {
        const route = {
            method,
            path: `/api/${path}`,
            handler,
        };

        Logger.scope('API').debug(`Registering route ${method} /api/${path}`);
        this.server.register(route);

        return route;
    }

    public unregisterRoute(route: Route) {
        Logger.scope('API').debug(`Unregistering route ${route.method} ${route.path}`);
        this.server.unregister(route);
    }
}
