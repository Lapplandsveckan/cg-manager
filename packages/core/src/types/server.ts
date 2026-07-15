import {
    Client,
    Method, Middleware,
    TypedClient, WebsocketOutboundMethod,
} from 'rest-exchange-protocol';
import {CasparManager} from './manager';
import {Route} from 'rest-exchange-protocol/dist/route';

export type CGClient = TypedClient<{}>;
export declare class CGServer {
    // constructor will not be available from plugin
    // constructor(manager: CasparManager, port?: number);
    private constructor(manager: CasparManager, port?: number);

    public broadcast<T>(target: string, method: WebsocketOutboundMethod, data: T, exclude?: Client);

    log(): Middleware;
    upload(): Middleware;
    web(): Middleware;
    cors(): Middleware;

    start(): Promise<void>;
    stop(): Promise<void>;

    public registerRoute(path: string, handler: Route['handler'], method: Method): Route;
    public unregisterRoute(route: Route): void;
}