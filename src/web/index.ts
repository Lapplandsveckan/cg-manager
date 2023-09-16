import next from 'next';
import * as http from 'http';
import {Logger} from '../util/log';
import config from '../util/config';

const hostname = 'localhost';
const port = config.port;

const app = next({ dev: false, hostname, port, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    Logger.scope('Web').info('Web server prepared');
});

export function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    return handle(req, res);
}