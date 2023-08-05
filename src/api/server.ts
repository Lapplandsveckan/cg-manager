import {MiddlewareProhibitFurtherExecution, REPServer} from 'rest-exchange-protocol';
import {loadRoutes} from './route';
import {TypedClient} from 'rest-exchange-protocol/dist/client';

export type CGClient = TypedClient<{}>;
export class CGServer {
    private server: REPServer;

    constructor(port?: number) {
        this.server = new REPServer({
            port,
        });

        const routes = loadRoutes();
        routes.forEach((route) => this.server.register(route));

        this.server.use(this.cors());
    }

    cors() {
        return data => {
            if (data.type !== 'http') return;

            data.response.setHeader('Access-Control-Allow-Origin', '*');
            data.response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
            data.response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Authentication');

            if (data.request.method !== 'OPTIONS') return;

            data.response.statusCode = 200;
            data.response.end();

            throw new MiddlewareProhibitFurtherExecution();
        };
    }

    async start() {
        await this.server.start();
    }

    async stop() {
        await this.server.stop();
    }
}