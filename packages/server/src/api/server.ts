import {
    type Client,
    type Method,
    type MiddleWareData,
    MiddlewareProhibitFurtherExecution,
    REPServer,
    type TypedClient,
    WebsocketClient,
    WebsocketOutboundMethod,
    type Route,
} from 'rest-exchange-protocol';
import { type RequestHandler } from 'express';
import { noTry, noTryAsync } from 'no-try';
import { loadRoutes } from './route';
import { type CasparManager } from '../manager';
import config from '../util/config';
import { handleRequest, onUpgrade } from '../web';
import { Logger } from '../util/log';
import { Upload } from '../manager/scanner/upload';
import { authMiddleware, authApiMiddleware } from './authMiddleware';
import { isInternalMediaId } from '../manager/scanner/folders';
import { mediaStreamMiddleware } from './mediaStream';
import { telemetryScriptMiddleware } from './telemetryScript';
import { type Config } from '../manager/caspar/config/types';
import {
    createPluginRouter,
    pluginHttpMiddleware,
    registerPluginHttp,
    unregisterPluginHttp,
} from './pluginHttp';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type CGClient = TypedClient<{}>;

export class CGServer {
    private server: REPServer;
    private manager: CasparManager;

    constructor(manager: CasparManager, port?: number) {
        this.manager = manager;

        this.server = new REPServer({
            port,
            host: config.host ?? undefined,
            path: config['socket-path'] ?? undefined,
        });

        const routes = loadRoutes();
        routes.forEach(route => this.server.register(route));

        // telemetryScript must precede auth (public, pre-login) and web() (Next would 404 it).
        this.server.use(this.cors());
        this.server.use(telemetryScriptMiddleware());
        this.server.use(authApiMiddleware());
        this.server.use(authMiddleware());
        this.server.use(this.previewWhep());
        this.server.use(mediaStreamMiddleware());
        this.server.use(pluginHttpMiddleware());
        this.server.use(this.upload());
        this.server.use(this.web());

        const action = WebsocketOutboundMethod.ACTION;

        this.manager.on('caspar-status', status =>
            this.broadcast('caspar/status', action, status),
        );

        this.manager.on('caspar-logs', logs =>
            this.broadcast('caspar/logs', action, logs),
        );

        this.manager.on('media', (key, value, origin?: Client) => {
            if (isInternalMediaId(key)) return;

            const isRemoval = value === null;
            const isProbed = (value as { mediainfo?: unknown })?.mediainfo;
            if (!isRemoval && !isProbed) return;

            this.broadcast('caspar/media', action, { key, value }, origin);
        });

        this.manager.on('caspar-running-config', (cfg: Config | null) =>
            this.broadcast('caspar/running-config', action, cfg ?? null),
        );

        this.manager.on('plugin-list-changed', () =>
            this.broadcast('plugins', action, this.manager.getPlugins().list()),
        );
    }

    public broadcast<T>(
        target: string,
        method: WebsocketOutboundMethod,
        data: T,
        exclude?: Client,
    ) {
        const isRecipient = (client: Client): client is WebsocketClient =>
            client !== exclude && client instanceof WebsocketClient;

        this.server
            .getClients()
            .filter(isRecipient)
            .forEach(client => client.send(target, method, data, false));
    }

    log() {
        return async (data: MiddleWareData) => {
            if (data.type !== 'pre-route') return;
            Logger.scope('API').debug(
                `${data.route.method} ${data.route.path}`,
            );
        };
    }

    previewWhep() {
        // No DELETE endpoint: ICE/DTLS state transitions handle teardown.
        return async (data: MiddleWareData) => {
            if (data.type !== 'http') return;

            const match = data.request.url.match(
                /^\/preview-whep\/(\d+)(?:\?.*)?$/,
            );
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

            const chunks: Buffer[] = [];
            for await (const chunk of data.request as unknown as AsyncIterable<Buffer>)
                chunks.push(chunk);
            const sdpOffer = Buffer.concat(chunks).toString('utf8');
            if (!sdpOffer.trim()) {
                data.response.statusCode = 400;
                data.response.end('Empty SDP offer');
                throw new MiddlewareProhibitFurtherExecution();
            }

            const [err, session] = await noTryAsync(() =>
                this.manager.preview.openWebRTC({ channel, sdpOffer }),
            );
            if (err || !session) {
                Logger.scope('Preview').warn(
                    `WHEP session failed: ${(err as Error)?.message}`,
                );
                data.response.statusCode = 503;
                data.response.end(
                    (err as Error)?.message ?? 'Failed to open preview',
                );
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

            const url = new URL(
                data.request.url,
                `http://${data.request.headers.host}`,
            );
            const id = url.searchParams.get('id')?.toString();
            if (!id) return answer(400, 'No id provided');

            const upload = Upload.get(id);
            if (!upload) return answer(404, 'Upload not found');

            const chunk = parseInt(url.searchParams.get('chunk'));
            if (
                Number.isNaN(chunk) ||
                chunk < 0 ||
                chunk >= upload['data'].total
            )
                return answer(400, 'Invalid chunk');

            const buffer: Uint8Array[] = [];
            data.request.on('data', chunk => buffer.push(chunk));
            data.request.on('end', async () => {
                const [err] = await noTryAsync(() =>
                    upload.bufferChunk(chunk, Buffer.concat(buffer)),
                );
                if (err)
                    return answer(500, err.message || 'Upload failed', false);
                answer(200, 'OK', false);
            });

            throw new MiddlewareProhibitFurtherExecution();
        };
    }

    web() {
        return async data => {
            if (
                data.type === 'websocket-upgrade' &&
                data.request.url.startsWith('/_next/')
            ) {
                if (!config.web) {
                    noTry(() => data.socket.destroy());
                    throw new MiddlewareProhibitFurtherExecution();
                }
                onUpgrade(data.request, data.socket, data.head);
                throw new MiddlewareProhibitFurtherExecution();
            }

            if (data.type !== 'http') return;
            if (data.request.url.startsWith('/api')) return;

            if (!config.web) {
                data.response.statusCode = 404;
                data.response.end();
                throw new MiddlewareProhibitFurtherExecution();
            }

            await handleRequest(data.request, data.response);
            throw new MiddlewareProhibitFurtherExecution();
        };
    }

    cors() {
        return data => {
            if (data.type !== 'http') return;

            data.response.setHeader('Access-Control-Allow-Origin', '*');
            data.response.setHeader(
                'Access-Control-Allow-Methods',
                'GET, POST, PUT, PATCH, DELETE',
            );
            data.response.setHeader(
                'Access-Control-Allow-Headers',
                'Content-Type, Authorization, Authentication',
            );

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

    public registerRoute(
        path: string,
        handler: Route['handler'],
        method: Method,
    ) {
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
        Logger.scope('API').debug(
            `Unregistering route ${route.method} ${route.path}`,
        );
        this.server.unregister(route);
    }

    public registerHttpHandler(pluginName: string, handler: RequestHandler) {
        Logger.scope('API').debug(`Registering HTTP handler for ${pluginName}`);
        registerPluginHttp(pluginName, handler);
    }

    public unregisterHttpHandler(pluginName: string, handler: RequestHandler) {
        Logger.scope('API').debug(
            `Unregistering HTTP handler for ${pluginName}`,
        );
        unregisterPluginHttp(pluginName, handler);
    }

    public createHttpRouter() {
        return createPluginRouter();
    }
}
