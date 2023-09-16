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


    constructor(host: string) {
        this.socket = new REPClient({
            host,
        });

        this.caspar = new CasparServerApi(this.socket);
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
