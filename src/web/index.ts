import '../util/vm-patch';
import * as http from 'http';
import next from 'next';
import { noTry } from 'no-try';
import { Logger } from '../util/log';
import config from '../util/config';

const logger = Logger.scope('Web');

let prepared: Promise<void> | null = null;
let handle: ReturnType<ReturnType<typeof next>['getRequestHandler']> | null =
    null;
let httpServer: http.Server | null = null;

/** Boot the Next.js web server. Must be called after `loadConfig()` so that
 *  `config.web`, `config.dev`, and `config.port` reflect the operator's
 *  config.json values. When `config.web` is false, this is a no-op. */
export function startWeb() {
    if (!config.web) return;

    const hostname = 'localhost';
    const port = config.port;

    httpServer = http.createServer(() => {});

    // Turbopack only runs in dev — pass through when config.dev is on so first
    // visits to a page compile in tens of ms instead of 1-2s. The flag is a
    // no-op for production server mode.
    const app = next({
        dev: config.dev,
        hostname,
        port,
        dir: __dirname,
        httpServer,
        turbopack: config.dev,
    });
    handle = app.getRequestHandler();

    // Kicks off Next.js init (bundling, dev-server boot, route tree, etc.).
    // The handler isn't safe to call until this resolves — otherwise it throws,
    // which our dev-mode `unhandledRejection` trap turns into a hard exit.
    // Stash the promise so request/upgrade callers can block until ready.
    prepared = app
        .prepare()
        .then(() => logger.info('Web server prepared'))
        .catch(err => {
            logger.error(err);
            throw err;
        });
}

export async function onUpgrade(
    req: http.IncomingMessage,
    socket: any,
    head: Buffer,
) {
    if (!httpServer || !prepared) {
        noTry(() => socket.destroy());
        return;
    }
    // The Next.js dev HMR socket can come in before prepare resolves;
    // queue it instead of letting `emit` reach a half-initialised app.
    await prepared.catch(() => undefined);
    httpServer.emit('upgrade', req, socket, head);
}

export async function handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
) {
    if (!handle || !prepared) {
        res.statusCode = 404;
        res.end();
        return;
    }
    // Calling `handle` before `prepare` rejects with an internal Next.js
    // error. Await once at the top so an early reload waits a beat
    // instead of returning 500 (or, worse, taking the process down).
    await prepared;
    return handle(req, res);
}
