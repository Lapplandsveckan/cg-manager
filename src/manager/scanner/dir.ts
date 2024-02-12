import fs from 'fs/promises';
import path from 'path';
import { v4 as uuid } from 'uuid';
import lnk from 'lnk';

export interface InternalMediaData {
    name: string;
    id: string;
    identifier: string;

    location: string;
    type: 'media' | 'template';
}

export class DirectoryManager {
    private static instance: DirectoryManager;
    public static getManager() {
        if (!DirectoryManager.instance) DirectoryManager.instance = new DirectoryManager();
        return DirectoryManager.instance;
    }

    private constructor() {

    }

    private mediaPath: string;
    private templatePath: string;
    private _created = false;

    private media = new Map<string, InternalMediaData>();
    initialize(mediaPath: string, templatePath: string) {
        this.mediaPath = mediaPath;
        this.templatePath = templatePath;

        return this.createDirectories();
    }

    createDirectories() {
        if (this._created) return Promise.resolve();
        this._created = true;

        return Promise.all([
            fs.mkdir(path.join(this.mediaPath, '_internal'), {recursive: true}),
            fs.mkdir(path.join(this.templatePath, '_internal'), {recursive: true}),
        ]);
    }

    deleteDirectories() {
        this._created = false;
        this.media.clear();

        return Promise.all([
            fs.rm(path.join(this.mediaPath, '_internal'), {recursive: true}),
            fs.rm(path.join(this.templatePath, '_internal'), {recursive: true}),
        ]);
    }

    public async createDirectory(type: 'media' | 'template', from: string): Promise<InternalMediaData> {
        if (!this._created) throw new Error('Directories not created');

        const id = uuid();
        const base = path.join(type === 'media' ? this.mediaPath : this.templatePath, '_internal');
        const location = path.join(base, id);
        const ext = path.extname(from);
        const filename = `${id}${ext}`;

        await lnk(from, base, { rename: filename });

        const data = {
            id,
            type,
            location,

            name: path.basename(from),
            identifier: `_internal/${filename}`.toUpperCase(),
        };

        this.media.set(data.id, data);
        return data;
    }

    public async deleteDirectory(id: string) {
        const data = this.media.get(id);
        if (!data) return;

        await fs.unlink(data.location);
        this.media.delete(id);
    }

    public async getDirectory(id: string) {
        return this.media.get(id);
    }
}