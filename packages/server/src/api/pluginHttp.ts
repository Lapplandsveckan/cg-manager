import express, {
    type ErrorRequestHandler,
    type RequestHandler,
    type Router,
} from 'express';
import {
    type MiddleWareData,
    MiddlewareProhibitFurtherExecution,
} from 'rest-exchange-protocol';
import { Logger } from '../util/log';

const log = Logger.scope('PluginHttp');
const prefix = '/api/plugin-http/';
const handlersByPlugin = new Map<string, RequestHandler[]>();
const routersByPlugin = new Map<string, Router>();

export const createPluginRouter = () => express.Router();

function rebuildRouter(pluginName: string) {
    const handlers = handlersByPlugin.get(pluginName) ?? [];
    if (!handlers.length) {
        handlersByPlugin.delete(pluginName);
        routersByPlugin.delete(pluginName);
        return;
    }

    const router = express.Router();
    handlers.forEach(handler => router.use(handler));
    routersByPlugin.set(pluginName, router);
}

export function registerPluginHttp(
    pluginName: string,
    handler: RequestHandler,
) {
    const handlers = handlersByPlugin.get(pluginName) ?? [];
    handlersByPlugin.set(pluginName, [...handlers, handler]);
    rebuildRouter(pluginName);
}

export function unregisterPluginHttp(
    pluginName: string,
    handler: RequestHandler,
) {
    const handlers = [...(handlersByPlugin.get(pluginName) ?? [])];
    const index = handlers.indexOf(handler);
    if (index < 0) return;

    handlers.splice(index, 1);
    handlersByPlugin.set(pluginName, handlers);
    rebuildRouter(pluginName);
}

const dispatch: RequestHandler = (req, res, next) => {
    const router = routersByPlugin.get(String(req.params.plugin));
    if (!router) return next();

    router(req, res, next);
};

const onError: ErrorRequestHandler = (error, req, res, _next) => {
    const status = error?.status ?? error?.statusCode ?? 500;
    const message = `${req.method} ${req.originalUrl}: ${error?.message ?? error}`;
    if (status >= 500) log.error(message);
    else log.debug(message);

    if (res.headersSent) return void res.destroy();
    res.status(status).end();
};

const app = express();
app.disable('x-powered-by');
app.use(`${prefix}:plugin`, dispatch);
app.use(onError);

export function pluginHttpMiddleware() {
    return (data: MiddleWareData) => {
        if (data.type !== 'http') return;
        if (!data.request.url?.startsWith(prefix)) return;

        app(data.request, data.response);
        throw new MiddlewareProhibitFurtherExecution();
    };
}
