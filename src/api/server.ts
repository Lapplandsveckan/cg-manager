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
import {noTry, noTryAsync} from 'no-try';
import {WebSocketServer} from 'ws';

export type CGClient = TypedClient<{}>;

// MPEG-TS preview args: lowest-latency H.264 we can muster from ffmpeg.
// CasparCG's ffmpeg consumer parses `-name value` pairs by long name and
// stream-suffix (see modules/ffmpeg/consumer/ffmpeg_consumer.cpp:502 + :517),
// so short forms like `-f` / `-c:v` / `-vf` are silently ignored — we have
// to spell every option in full (`format`, `codec:v`, `filter:v`, …).
//
// Latency notes:
// - `-r:v 15` only sets the encoder context's frame-rate; it does NOT
//   downsample fps. Putting `fps=15` *in the filter chain* is what makes
//   libx264 actually see 15 frames per second instead of all 60 from the
//   source. Without this we'd encode 4× the frames and the MSE buffer
//   would drift behind live within seconds.
// - `flush_packets` + `muxdelay` 0 stop the MPEG-TS muxer from holding
//   PES packets back waiting for "a bit more" before shipping them.
// - `g:v 15` = one keyframe per second @ 15fps. mpegts.js / MSE has to
//   wait for the next keyframe to chase forward, so shorter GOP means
//   live-edge catch-up settles sooner at the cost of some bitrate.
// - `bf:v 0` disables B-frames (already implied by `tune zerolatency`,
//   but explicit so reordering can't be reintroduced).
// - `tune zerolatency` + `preset ultrafast` keep the encode pipeline flat
//   (single-pass, minimal look-ahead).
// - MPEG-TS defaults to MP2 audio (mono/stereo only); the consumer's
//   audio sink doesn't constrain channel layouts (TODO at
//   ffmpeg_consumer.cpp:261), so CasparCG's 16-ch hexadecagonal input
//   would otherwise blow up `avcodec_open2`. `filter:a` forces stereo so
//   the auto-inserted resampler handles the downmix.
const MPEGTS_PREVIEW_ARGS = [
    '-format',
    'mpegts',
    '-codec:v',
    'libx264',
    '-preset:v',
    'ultrafast',
    '-tune:v',
    'zerolatency',
    '-pix_fmt:v',
    'yuv420p',
    '-bf:v',
    '0',
    '-g:v',
    '15',
    '-b:v',
    '800k',
    '-filter:v',
    'fps=15,scale=640:-2',
    '-flush_packets',
    '1',
    '-muxdelay',
    '0',
    '-muxpreload',
    '0',
    '-filter:a',
    'aformat=channel_layouts=stereo',
];

export class CGServer {
    private server: REPServer;
    private manager: CasparManager;
    private wss: WebSocketServer;

    constructor(manager: CasparManager, port?: number) {
        this.manager = manager;

        this.server = new REPServer({
            port,
        });

        // No internal http.Server — we hand-off upgrade events via
        // `wss.handleUpgrade(req, socket, head, cb)` from the websocket-upgrade
        // middleware. `noServer: true` is the canonical pattern for this.
        this.wss = new WebSocketServer({noServer: true});

        const routes = loadRoutes();
        routes.forEach((route) => this.server.register(route));

        // this.server.use(this.log());

        // Preview middlewares MUST run before web(): web() forwards every
        // non-/api HTTP request to Next.js and throws
        // MiddlewareProhibitFurtherExecution, which would otherwise eat
        // /preview-whep/:ch (and /preview/:ch) before they can be handled.
        // The WS variants are unaffected because web() only catches
        // /_next/* upgrades, but we keep them grouped for clarity.
        this.server.use(this.preview());
        this.server.use(this.previewWs());
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

    previewWs() {
        // ws://host/preview-ws/:channel — MPEG-TS stream over WebSocket
        // binary frames. Browser uses mpegts.js + MSE to play.
        return async (data: MiddleWareData) => {
            if (data.type !== 'websocket-upgrade') return;

            const match = data.request.url?.match(/^\/preview-ws\/(\d+)(?:\?.*)?$/);
            if (!match) return;

            const channel = parseInt(match[1], 10);
            if (!Number.isFinite(channel) || channel < 1) {
                data.socket.destroy();
                throw new MiddlewareProhibitFurtherExecution();
            }

            this.wss.handleUpgrade(data.request, data.socket, data.head, (ws) => {
                let session: PreviewSession | null = null;
                let alive = true;

                const cleanup = () => {
                    if (!alive) return;
                    alive = false;
                    session?.close().catch(() => undefined);
                    if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) 
                        ws.close();
                    
                };

                ws.on('close', cleanup);
                ws.on('error', cleanup);

                this.manager.preview.openSession({channel, ffmpegArgs: MPEGTS_PREVIEW_ARGS})
                    .then((s) => {
                        if (!alive) {
                            // Client gave up before we got the session — tear it
                            // down immediately so we don't leak an encoder.
                            s.close().catch(() => undefined);
                            return;
                        }
                        session = s;
                        // Drop chunks when the client can't keep up — without
                        // this, a slow browser balloons `bufferedAmount` and
                        // the preview falls minutes behind. The MPEG-TS muxer
                        // is keyframe-resilient (1s GOP), so dropping a few
                        // packets shows up as a glitch and self-resyncs.
                        const HIGH_WATER_MARK = 4 * 1024 * 1024; // 4MB
                        s.onData((chunk) => {
                            if (ws.readyState !== ws.OPEN) return;
                            if (ws.bufferedAmount > HIGH_WATER_MARK) return;
                            ws.send(chunk, {binary: true});
                        });
                    })
                    .catch((err: Error) => {
                        Logger.scope('Preview').warn(`WS session failed: ${err.message}`);
                        ws.close(1011, err.message?.slice(0, 120) ?? 'Preview unavailable');
                    });
            });

            throw new MiddlewareProhibitFurtherExecution();
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
            // quality for preview, low bandwidth). Tunable later. Long-form
            // option names — see MPEGTS_PREVIEW_ARGS for why.
            const args = [
                '-format',
                'mpjpeg',
                '-qscale:v',
                '5',
                '-r:v',
                '15',
                '-filter:v',
                'scale=640:-1',
            ];

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