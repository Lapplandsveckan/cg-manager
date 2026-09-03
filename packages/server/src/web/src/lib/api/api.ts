/**
 * Licenced under Eliyah Enterprises Ltd Inc.
 * All credit goes to Eliyah.
 */
import { REPClient, type Method } from 'rest-exchange-protocol-client';
import { BroadcastDispatcher } from './broadcastDispatcher';
import { CasparServerApi } from './caspar';
import { PluginInjectionAPI } from './inject';
import { PluginApi } from './plugin';
import { RundownsApi } from './rundowns';
import { VideoRoutesApi } from './videoRoutes';
import { CLIENT_ERROR_PATH } from '../reportClientError';

export { WebError } from 'rest-exchange-protocol-client';

export class ManagerApi {
    private socket: REPClient;
    private broadcasts: BroadcastDispatcher;

    public caspar: CasparServerApi;
    public injects: PluginInjectionAPI;
    public plugin: PluginApi;
    public videoRoutes: VideoRoutesApi;
    public rundowns: RundownsApi;

    private static instance: ManagerApi;
    public static getConnection() {
        return ManagerApi.instance;
    }

    /** The only way to listen for a server broadcast — `BroadcastDispatcher`
     *  is the sole holder of `socket.routes`, so two subscribers on the same
     *  topic can never shadow each other (see its docstring). */
    public subscribe(
        path: string,
        method: Method,
        handler: (data: unknown) => void,
    ): () => void {
        return this.broadcasts.subscribe(path, method, handler);
    }

    /** True while the websocket transport is actually open. Requests fall
     *  back to HTTP when it drops, so a successful request does NOT imply
     *  broadcasts are alive — poll this to detect a dead socket. Reaches
     *  into REPClient's private getter (advisory privacy, same pattern as
     *  Logger). */
    public get wsConnected(): boolean {
        return Boolean(this.socket['connected']);
    }

    constructor(host: string) {
        ManagerApi.instance = this;

        this.socket = new REPClient({
            host,
        });
        this.broadcasts = new BroadcastDispatcher(this.socket.routes);

        this.caspar = new CasparServerApi(this.socket, this.broadcasts);
        this.injects = new PluginInjectionAPI(this.socket);
        this.plugin = new PluginApi(this.socket);
        this.videoRoutes = new VideoRoutesApi(this.socket);
        this.rundowns = new RundownsApi(this.socket);
    }

    public async rawRequest<T>(
        path: string,
        method: string,
        data: T,
    ): Promise<unknown> {
        return this.socket.request(path, method, data);
    }

    public async connect() {
        this.socket.connect();
    }

    public async disconnect() {
        this.socket.disconnect();
    }

    public async getApiVersion(): Promise<string> {
        const res = await this.socket.request('api/version', 'GET', {});
        return res as string;
    }

    /** Fire-and-forget: caller (reportClientError) swallows the rejection. */
    public async logClientError(report: unknown): Promise<void> {
        await this.socket.request(CLIENT_ERROR_PATH, 'ACTION', report);
    }
}
