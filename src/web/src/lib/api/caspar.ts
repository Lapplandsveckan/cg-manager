import {REPClient} from 'rest-exchange-protocol-client';
import EventEmitter from 'events';

/**
 * All API calls relevant to CasparCG are handled here.
 */

export class CasparServerApi extends EventEmitter {
    private socket: REPClient;
    private status: { running: boolean } = { running: false };

    private logs: string = '';

    constructor(socket: REPClient) {
        super();
        this.socket = socket;

        this.socket.routes.action('api/caspar/status', async (request) => {
            const status = request.data as { running: boolean };
            this.status = status;

            console.log('status', status);

            this.emit('status', status);
        });

        this.socket.routes.action('api/caspar/logs', async (request) => {
            const logs = request.data as string;
            this.logs += logs;

            this.emit('logs', logs);
        });
    }

    /**
     * Starting caspar server.
     *
     */
    public async start() {
        await this.socket.request('api/caspar/start', 'ACTION', {});
    }

    /**
     * Stopping caspar server.
     */
    public async stop() {
        await this.socket.request('api/caspar/stop', 'ACTION', {});
    }

    /**
     * Restarting caspar server.
     */
    public async restart() {
        await this.socket.request('api/caspar/restart', 'ACTION', {});
    }

    /**
     * Getting caspar server status.
     */
    public async getStatus() {
        this.status = await this.socket.request('api/caspar/status', 'GET', {}).then(v => v.data);
        this.emit('status', this.status);

        return this.status;
    }

    public async getLogs() {
        this.logs = await this.socket.request('api/caspar/logs', 'GET', {}).then(v => v.data);

        return this.logs;
    }
}