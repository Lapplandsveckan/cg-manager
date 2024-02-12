import config, {loadCasparConfig} from './config';
import Scanner from './scanner';
import App from './app';
import {FileDatabase} from './db';
import {DirectoryManager} from './dir';

async function start() {
    await loadCasparConfig();

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

    private db: FileDatabase;
    private server: any;
    private scanner: any;

    public started: boolean = false;

    async start() {
        if (this.started) return;
        this.started = true;

        await loadCasparConfig();

        this.db = new FileDatabase();
        this.scanner = Scanner(this.db);

        const app = App(this.db);
        this.server = app.listen(config.http.port);

        await DirectoryManager.getManager().initialize(config.paths.media, config.paths.template);
    }

    async stop() {
        if (!this.started) return;
        this.started = false;

        this.server.close();
        this.db.close();

        await this.scanner.stop();
        await DirectoryManager.getManager().deleteDirectories();
    }

    public getDatabase() {
        return this.db;
    }
}