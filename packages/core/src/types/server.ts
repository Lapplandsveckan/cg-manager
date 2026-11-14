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

/** How a plugin's own API surface is credentialed. The host's full policy
 *  table also knows share tokens, but those are positional in the URL and so
 *  stay host-internal. */
export type RoutePolicy = 'public' | 'session';

export interface RouteRegistration {
    /** `session` (the default) keeps the route behind the manager's auth gate;
     *  `public` makes it reachable without credentials, for a surface a guest
     *  has to be able to hit.
     *
     *  `public` is matched by URL prefix, so it is coarser than one
     *  registration: a route with a path parameter opens its parent path
     *  (`items/:id` opens `items/`, siblings included), and on an HTTP handler
     *  it opens the plugin's whole `/api/plugin-http/<name>/` mount. Split
     *  anything that must stay authenticated onto a path of its own. */
    policy?: RoutePolicy;
}

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
        options?: RouteRegistration,
    ): Route;
    public unregisterRoute(route: Route): void;

    public registerHttpHandler(
        pluginName: string,
        handler: HttpHandler,
        options?: RouteRegistration,
    ): void;
    public unregisterHttpHandler(
        pluginName: string,
        handler: HttpHandler,
    ): void;
    public createHttpRouter(): HttpRouter;
}
