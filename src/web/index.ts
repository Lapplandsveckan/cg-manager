import * as http from 'http';
import next from 'next';
import { Logger } from '../util/log';
import config from '../util/config';

const logger = Logger.scope('Web');
const hostname = 'localhost';
const port = config.port;

const httpServer = http.createServer(() => {});

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
const handle = app.getRequestHandler();

// Kicks off Next.js init (bundling, dev-server boot, route tree, etc.).
// The handler isn't safe to call until this resolves — otherwise it throws,
// which our dev-mode `unhandledRejection` trap turns into a hard exit.
// Stash the promise so request/upgrade callers can block until ready.
const prepared = app
    .prepare()
    .then(() => logger.info('Web server prepared'))
    .catch(err => {
        logger.error(err);
        throw err;
    });

export async function onUpgrade(
    req: http.IncomingMessage,
    socket: any,
    head: Buffer,
) {
    // The Next.js dev HMR socket can come in before prepare resolves;
    // queue it instead of letting `emit` reach a half-initialised app.
    await prepared.catch(() => undefined);
    httpServer.emit('upgrade', req, socket, head);
}

export async function handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
) {
    // Calling `handle` before `prepare` rejects with an internal Next.js
    // error. Await once at the top so an early reload waits a beat
    // instead of returning 500 (or, worse, taking the process down).
    await prepared;
    return handle(req, res);
}
