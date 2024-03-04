import * as path from 'path';
import { promises as fs, WriteStream } from 'fs';
import {Logger} from '../../util/log';
import {DirectoryManager} from './dir';
import * as os from 'os';

interface UploadDestination {
    uri: string;
    type: 'template' | 'media';
}

interface UploadBuffer {
    index: number;
    data: Buffer;
}

interface UploadData {
    destination: UploadDestination;

    total: number;
    chunkIndex: number;
    buffer: UploadBuffer[];
}

interface UploadFile {
    handle: fs.FileHandle;
    stream: WriteStream;
}

export class Upload {
    private static readonly uploads = new Map<string, Upload>();
    public readonly id: string;

    private file: UploadFile;
    private readonly data: UploadData;

    private readonly logger: Logger;
    private timeout?: NodeJS.Timeout;

    private readonly tempPath: string;

    private constructor(destination: UploadDestination, total: number) {
        this.id = Math.random().toString(36).substring(2, 11);
        this.data = {
            destination,
            total,
            chunkIndex: 0,
            buffer: [],
        };

        this.logger = Logger.scope('File Upload').scope(this.id);
        this.logger.info(`Started upload to ${this.destinationLog} (${total} chunks)`);

        this.tempPath = this.getTemporaryPath();
        Upload.uploads.set(this.id, this);
    }

    private get destinationLog() {
        const type = this.data.destination.type === 'template' ? 'Template' : 'Media';
        return `${type} ${this.data.destination.uri}`;
    }

    private get basePath() {
        if (this.data.destination.type === 'template') return DirectoryManager.getManager()['templatePath'];
        if (this.data.destination.type === 'media') return DirectoryManager.getManager()['mediaPath'];

        throw new Error('Invalid destination type');
    }

    private getTemporaryPath() {
        if (this.tempPath) return this.tempPath;

        const tmpFolder = os.tmpdir();
        return path.join(tmpFolder, this.id);
    }

    private getPath() {
        return path.join(this.basePath, this.data.destination.uri);
    }

    async openFile() {
        const handle = await fs.open(this.getTemporaryPath(), 'a');
        this.file = {
            handle,
            stream: handle.createWriteStream(),
        };
    }

    async closeFile(deleteFile = false) {
        const { stream, handle } = this.file;

        await new Promise<void>((res) => stream.end(() => res()));
        await handle.close();

        if (deleteFile)
            await fs.unlink(this.getTemporaryPath())
                .catch(() => this.logger.warn('Failed to delete file'));
    }

    public async cancel() {
        if (this.timeout) clearTimeout(this.timeout);
        Upload.uploads.delete(this.id);

        await this.closeFile(true);
        this.logger.info(`Upload canceled ${this.destinationLog}`);
    }

    // TODO: find if there is a possible way to append the received buffer to the file even though they are not in order, this would be more efficient and save on memory
    public writeBuffer() {
        const { chunkIndex, buffer } = this.data;
        if (buffer.length < 1) return;

        for (let i = 0; i < buffer.length; i++) {
            const chunk = buffer[i];
            if (chunk.index !== this.data.chunkIndex) break;

            this.data.chunkIndex++;
            this.file.stream.write(chunk.data);
        }

        buffer.splice(0, this.data.chunkIndex - chunkIndex);
    }

    public addChunk(chunk: UploadBuffer) {
        const { buffer } = this.data;
        for (let i = 0; ; i++) {
            if (i < buffer.length && buffer[i].index < chunk.index) continue;

            buffer.splice(i, 0, chunk);
            break;
        }
    }

    public async endUpload() {
        const { chunkIndex, total } = this.data;
        if (chunkIndex !== total) return;

        if (this.timeout) clearTimeout(this.timeout);

        Upload.uploads.delete(this.id);
        await this.closeFile();

        await fs.rename(this.getTemporaryPath(), this.getPath());
        this.logger.info(`Upload complete ${this.destinationLog}`);
    }

    public async bufferChunk(chunkIndex: number, chunk: Buffer) {
        if (this.timeout) clearTimeout(this.timeout);
        this.timeout = setTimeout(() => this.cancel(), 30 * 1000);

        this.addChunk({ index: chunkIndex, data: chunk });
        this.writeBuffer();
        await this.endUpload();
    }

    public static get(id: string) {
        return Upload.uploads.get(id);
    }

    public static async create(type: UploadDestination['type'], uri: string, chunks: number) {
        const upload = new Upload({
            type,
            uri,
        }, chunks);
        await upload.openFile();

        return upload;
    }
}