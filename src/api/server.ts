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
import {PreviewSession} from '../manager/preview/preview';
import {noTry} from 'no-try';

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

        this.server.use(this.web());
        this.server.use(this.cors());
        this.server.use(this.upload());
        this.server.use(this.preview());

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

    preview() {
        // GET /preview/:channel — MJPEG HTTP multipart stream. Spins up a
        // CasparCG ffmpeg consumer per client; tears it down when the
        // browser closes the connection.
        return async (data: MiddleWareData) => {
            if (data.type !== 'http') return;

            const match = data.request.url.match(/^\/preview\/(\d+)(?:\?.*)?$/);
            if (!match) return;

            const channel = parseInt(match[1], 10);
            if (!Number.isFinite(channel) || channel < 1) {
                data.response.statusCode = 400;
                data.response.end('Invalid channel');
                throw new MiddlewareProhibitFurtherExecution();
            }

            // Modest output: 640px-wide MJPEG at 15fps, qscale 5 (good
            // quality for preview, low bandwidth). Tunable later.
            const args = '-f mpjpeg -q:v 5 -r 15 -vf scale=640:-1';

            let session: PreviewSession | null = null;
            const [err] = await noTry(async () => {
                session = await this.manager.preview.openSession({channel, ffmpegArgs: args});
            });
            if (err || !session) {
                data.response.statusCode = 503;
                data.response.end((err as Error)?.message ?? 'Failed to open preview');
                throw new MiddlewareProhibitFurtherExecution();
            }

            // The mpjpeg muxer uses `ffserver` as the multipart boundary
            // (encoded in the stream); the browser pairs it with the
            // Content-Type header we set here.
            data.response.statusCode = 200;
            data.response.setHeader('Content-Type', 'multipart/x-mixed-replace; boundary=ffserver');
            data.response.setHeader('Cache-Control', 'no-cache');
            data.response.setHeader('Connection', 'close');
            data.response.setHeader('Pragma', 'no-cache');

            session.onData((chunk) => {
                // `write` returns false when the kernel buffer fills —
                // ignoring that is fine for MJPEG since dropped backpressure
                // just means a momentarily slow client; ffmpeg will keep
                // pushing the next frame regardless.
                data.response.write(chunk);
            });

            const cleanup = () => { session?.close().catch(() => undefined); };
            data.request.on('close', cleanup);
            data.response.on('close', cleanup);

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