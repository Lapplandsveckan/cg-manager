import config from './config';
import baseConfig from '../../util/config';
import Scanner from './scanner';
import App from './app';
import {FileDatabase} from './db';
import {DirectoryManager} from './dir';
import fs from 'fs/promises';

export class MediaScanner {
    private db: FileDatabase;
    private server: any;
    private scanner: any;

    public started: boolean = false;

    async start() {
        if (this.started) return;
        this.started = true;

        this.db = new FileDatabase();

        const data = await fs.readFile(baseConfig['db-file'], 'utf8')
            .catch(() => '{}');

        this.db.load(data);
        this.scanner = Scanner(this.db);

        const app = App(this.db);
        this.server = app.listen(8000); // TODO: do we need this

        await DirectoryManager.getManager().initialize(config.paths.media, config.paths.template);
    }

    async stop() {
        if (!this.started) return;
        this.started = false;

        const data = this.db.save();
        await fs.writeFile(baseConfig['db-file'], data);

        this.server.close();
        this.db.close();

        await this.scanner.stop();
        await DirectoryManager.getManager().deleteDirectories();
    }

    public getDatabase() {
        return this.db;
    }
}