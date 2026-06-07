/**
 * Licenced under Eliyah Enterprises Ltd Inc.
 * All credit goes to Eliyah.
 */
import { REPClient } from 'rest-exchange-protocol-client';
import { CasparServerApi } from './caspar';
import { PluginInjectionAPI } from './inject';
import { PluginApi } from './plugin';
import { VideoRoutesApi } from './videoRoutes';

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

    constructor(host: string) {
        ManagerApi.instance = this;

        this.socket = new REPClient({
            host,
        });

        this.caspar = new CasparServerApi(this.socket);
        this.injects = new PluginInjectionAPI(this.socket);
        this.plugin = new PluginApi(this.socket);
        this.videoRoutes = new VideoRoutesApi(this.socket);
    }

    public async rawRequest(path: string, method: string, data: any) {
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
