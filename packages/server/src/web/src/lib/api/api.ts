/**
 * Licenced under Eliyah Enterprises Ltd Inc.
 * All credit goes to Eliyah.
 */
import { CasparServerApi } from './caspar';
import { PluginInjectionAPI } from './inject';
import { PluginApi } from './plugin';
import { CheckedRepClient } from './repClient';
import { VideoRoutesApi } from './videoRoutes';

export { RequestError } from './repClient';

export class ManagerApi {
    private socket: CheckedRepClient;

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

        this.socket = new CheckedRepClient({
            host,
        });

        this.caspar = new CasparServerApi(this.socket);
        this.injects = new PluginInjectionAPI(this.socket);
        this.plugin = new PluginApi(this.socket);
        this.videoRoutes = new VideoRoutesApi(this.socket);

        // Refresh the injection manifest whenever the plugin list changes so
        // newly installed plugin UI appears live without a reload.
        this.plugin.on('change', () => this.injects.refresh());
    }

    public async rawRequest<T>(path: string, method: string, data: T) {
        return this.socket.request(path, method, data);
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
