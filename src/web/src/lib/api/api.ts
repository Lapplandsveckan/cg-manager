/**
 * Licenced under Eliyah Enterprises Ltd Inc.
 * All credit goes to Eliyah.
 */
import {REPClient} from 'rest-exchange-protocol-client';
import {CasparServerApi} from './caspar';


/**
 * Eliyah masterfully crafted custom exchange protocol being in use here.
 * Initialized here below.
 */
export class ManagerApi {
    private socket: REPClient;

    public caspar: CasparServerApi;

    private static instance: ManagerApi;
    public static getConnection() {
        return ManagerApi.instance;
    }

    constructor(host: string) {
        ManagerApi.instance = this;

        this.socket = new REPClient({
            host,
        });

        this.caspar = new CasparServerApi(this.socket);
    }

    public async rawRequest(path: string, method: string, data: any) {
        return this.socket.request(path, method, data);
    }

    /**
     * Connect to socket.
     */
    public async connect() {
        this.socket.connect();
    }

    /**
     * Disconnect from customer RE(liyah)ST super socket.
     */
    public async disconnect() {
        this.socket.disconnect();
    }

    public async getApiVersion() {
        return await this.socket.request('api/version', 'GET', {});
    }

    // functions to do stuff
}
