import {
    type Client,
    type Method,
    type Middleware,
    type TypedClient,
    type WebsocketOutboundMethod,
    type Route,
} from 'rest-exchange-protocol';
import { type CasparManager } from './manager';

export type CGClient = TypedClient<object>;

/* eslint-disable @typescript-eslint/no-explicit-any */
export type HttpHandler = (
    req: any,
    res: any,
    next: (error?: unknown) => void,
) => unknown;

type HttpRouteMethod = (
    path: string | HttpHandler,
    ...handlers: HttpHandler[]
) => HttpRouter;

export type HttpRouter = HttpHandler & {
    use: HttpRouteMethod;
    all: HttpRouteMethod;
    get: HttpRouteMethod;
    post: HttpRouteMethod;
    put: HttpRouteMethod;
    patch: HttpRouteMethod;
    delete: HttpRouteMethod;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export declare class CGServer {
    // constructor will not be available from plugin
    // constructor(manager: CasparManager, port?: number);
    private constructor(manager: CasparManager, port?: number);

    public broadcast<T>(
        target: string,
        method: WebsocketOutboundMethod,
        data: T,
        exclude?: Client,
    );

    log(): Middleware;
    upload(): Middleware;
    web(): Middleware;
    cors(): Middleware;

    start(): Promise<void>;
    stop(): Promise<void>;

    public registerRoute(
        path: string,
        handler: Route['handler'],
        method: Method,
    ): Route;
    public unregisterRoute(route: Route): void;

    public registerHttpHandler(pluginName: string, handler: HttpHandler): void;
    public unregisterHttpHandler(
        pluginName: string,
        handler: HttpHandler,
    ): void;
    public createHttpRouter(): HttpRouter;
}
