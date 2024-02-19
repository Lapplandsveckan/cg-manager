import {
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

        this.server.use(this.web());
        this.server.use(this.cors());
        this.server.use(this.upload());

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
    }

    public unregisterRoute(path: string, method: Method) {
        // TODO: Implement unregisterRoute
    }
}