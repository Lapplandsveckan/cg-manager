import fs from 'fs/promises';
import config from './config';
import baseConfig from '../../util/config';
import Scanner from './scanner';
import App from './app';
import { FileDatabase } from './db';
import { DirectoryManager } from './dir';
import { ensureFolderPlaceholders } from './folders';
import { Upload } from './upload';

export class MediaScanner {
    private db: FileDatabase;
    private server: any;
    private scanner: any;

    public started: boolean = false;

    async start() {
        if (this.started) return;
        this.started = true;

        this.db = new FileDatabase();

        const data = await fs
            .readFile(baseConfig['db-file'], 'utf8')
            .catch(() => '{}');

        this.db.load(data);
        this.scanner = Scanner(this.db);
        Upload.onComplete = path => void this.scanner.scan(path);

        const app = App(this.db);
        // Bind to loopback only — this scanner API is unauthenticated and is
        // consumed solely by the local CasparCG process. Exposing it on all
        // interfaces would leak the media/template library to the LAN. Revisit
        // if we ever support CasparCG on a separate host.
        this.server = app.listen(8000, '127.0.0.1');

        await DirectoryManager.getManager().initialize(
            config.paths.media,
            config.paths.template,
        );

        // Backfill: ensure every existing folder under media root has a .cgkeep placeholder
        // so it persists even if its real media is removed later
        await ensureFolderPlaceholders(config.paths.media);
    }

    async stop() {
        if (!this.started) return;
        this.started = false;

        const data = this.db.save();
        await fs.writeFile(baseConfig['db-file'], data);

        Upload.onComplete = undefined;

        this.server.close();
        this.db.close();

        await this.scanner.stop();
        await DirectoryManager.getManager().deleteDirectories();
    }

    public getDatabase() {
        return this.db;
    }

    public applyDelete(mediaPath: string) {
        this.scanner.applyDelete(mediaPath);
    }

    public applyRename(oldPath: string, newPath: string) {
        return this.scanner.applyRename(oldPath, newPath);
    }

    public get mediaRoot() {
        return config.paths.media;
    }
}
