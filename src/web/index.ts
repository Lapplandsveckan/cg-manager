import next from 'next';
import * as http from 'http';
import {Logger} from '../util/log';
import config from '../util/config';

const hostname = 'localhost';
const port = config.port;

const httpServer = http.createServer(() => {});

const app = next({ dev: config.dev, hostname, port, dir: __dirname, httpServer });
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