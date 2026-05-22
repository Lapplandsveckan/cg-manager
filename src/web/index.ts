import next from 'next';
import * as http from 'http';
import {Logger} from '../util/log';
import config from '../util/config';

const hostname = 'localhost';
const port = config.port;

const httpServer = http.createServer(() => {});

// Turbopack only runs in dev — pass through when config.dev is on so first
// visits to a page compile in tens of ms instead of 1-2s. The flag is a
// no-op for production server mode.
const app = next({ dev: config.dev, hostname, port, dir: __dirname, httpServer, turbopack: config.dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    Logger.scope('Web').info('Web server prepared');
});

export function onUpgrade(req: http.IncomingMessage, socket: any, head: Buffer) {
    httpServer.emit('upgrade', req, socket, head);
}

export function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    return handle(req, res);
}
