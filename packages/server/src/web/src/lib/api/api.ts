/**
 * Licenced under Eliyah Enterprises Ltd Inc.
 * All credit goes to Eliyah.
 */
import { REPClient } from 'rest-exchange-protocol-client';
import { CasparServerApi } from './caspar';
import { PluginInjectionAPI } from './inject';
import { PluginApi } from './plugin';
import { VideoRoutesApi } from './videoRoutes';

/** The REP websocket transport resolves every reply, success or failure —
 *  it never rejects the request promise. A failed request comes back as
 *  `{status, error}` instead of `{status: 200, data}`. Carries `.status`
 *  so callers can branch on the code (e.g. a 409 "folder not empty"). */
export class RequestError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

export class ManagerApi {
    private socket: REPClient;

    public caspar: CasparServerApi;
    public injects: PluginInjectionAPI;
    public plugin: PluginApi;
    public videoRoutes: VideoRoutesApi;

    private static instance: ManagerApi;
    public static getConnection() {
        return ManagerApi.instance;
    }

    public get routes() {
        return this.socket.routes;
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

        this.caspar = new CasparServerApi(this);
        this.injects = new PluginInjectionAPI(this);
        this.plugin = new PluginApi(this);
        this.videoRoutes = new VideoRoutesApi(this);

        // Refresh the injection manifest whenever the plugin list changes so
        // newly installed plugin UI appears live without a reload.
        this.plugin.on('change', () => this.injects.refresh());
    }

    public async rawRequest<T>(path: string, method: string, data: T) {
        const res = await this.socket.request(path, method, data);
        if (res && typeof res.status === 'number' && res.status >= 400)
            throw new RequestError(res.error ?? 'Request failed', res.status);
        return res;
    }

    public async connect() {
        this.socket.connect();
    }

    public async disconnect() {
        this.socket.disconnect();
    }

    public async getApiVersion() {
        return await this.socket.request('api/version', 'GET', {});
    }
}
