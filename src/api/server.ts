import {
    Client,
    Method, MiddleWareData,
    MiddlewareProhibitFurtherExecution,
    REPServer,
    TypedClient,
    WebsocketClient, WebsocketOutboundMethod,
} from 'rest-exchange-protocol';
import {loadRoutes} from './route';
import {CasparManager} from '../manager';
import {handleRequest, onUpgrade} from '../web';
import {Route} from 'rest-exchange-protocol/dist/route';
import {Logger} from '../util/log';
import {Upload} from '../manager/scanner/upload';
import {isInternalMediaId} from '../manager/scanner/folders';
import {noTryAsync} from 'no-try';

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

        // previewWhep() must run before web(): web() forwards every non-/api
        // HTTP request to Next.js and throws MiddlewareProhibitFurtherExecution,
        // which would otherwise eat /preview-whep/:ch before it can be handled.
        this.server.use(this.previewWhep());
        this.server.use(this.cors());
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
            const clients = this.server.getClients();
            clients.forEach((client) => {
                if (!(client instanceof WebsocketClient)) return;
                client.send('caspar/media', WebsocketOutboundMethod.ACTION, { key, value }, false);
            });
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
            method: method,
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