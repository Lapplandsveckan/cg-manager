import config from './config';
import Scanner from './scanner';
import App from './app';
import {FileDatabase} from './db';

function start() {
    const db = new FileDatabase();
    const scanner = Scanner(db);
    const app = App(db);
    const server = app.listen(config.http.port);

    return async () => {
        server.close();

        await scanner.stop();
        await db.close();
    };
}

export class MediaScanner {
    private cancel: () => Promise<void> | void = null;

    async start() {
        if (this.cancel) return;
        this.cancel = await start();
    }

    async stop() {
        if (!this.cancel) return;
        await this.cancel();
        this.cancel = null;
    }
}