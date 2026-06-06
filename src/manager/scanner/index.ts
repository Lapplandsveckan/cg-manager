import fs from 'fs/promises';
import config from './config';
import baseConfig from '../../util/config';
import Scanner from './scanner';
import App from './app';
import {FileDatabase} from './db';
import {DirectoryManager} from './dir';
import {ensureFolderPlaceholders} from './folders';

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
        this.server = app.listen(8000);

        await DirectoryManager.getManager().initialize(config.paths.media, config.paths.template);

        // Backfill: ensure every existing folder under media root has a .cgkeep placeholder
        // so it persists even if its real media is removed later
        await ensureFolderPlaceholders(config.paths.media);
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

    public get mediaRoot() {
        return config.paths.media;
    }
}
