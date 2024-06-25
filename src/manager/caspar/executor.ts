import net from 'net';
import {Logger} from '../../util/log';
import {getTemplatesWithContent} from '../scanner/scanner';
import {Command, CommandExecutor} from '@lappis/cg-manager';

export class CasparExecutor extends CommandExecutor {
    private client: net.Socket;
    private _connected: boolean = false;

    public readonly ip: string;
    public readonly port: number;

    private retryTimeout: NodeJS.Timeout;
    private retry = true;
    private buffer = '';

    protected _fetchTemplates(): Promise<any[]> {
        return getTemplatesWithContent();
    }

    constructor(port?: number, ip?: string) {
        super();

        this.ip = ip ?? '127.0.0.1';
        this.port = port ?? 5250;
    }

    public get connected(): boolean {
        return this._connected;
    }

    public connect() {
        this.retry = true;
        this._internalConnect();
    }

    private _internalConnect() {
        if (this.client) this.client.destroy();

        this.client = net.connect(this.port, this.ip, () => this.onConnect());

        this.client.on('end', () => this.onDisconnect());
        this.client.on('error', e => this.onDisconnect(e));

        let responseBuffer = '';
        this.client.on('data', d => responseBuffer = this.receive(responseBuffer + d.toString()));
    }

    public disconnect() {
        this.retry = false;
        this.onDisconnect();
    }

    protected send(data: string) {
        if (!this.client) return this.buffer += data;
        if (this.buffer) data = this.buffer + data;
        this.client.write(data);

        const lines = data.replace(/\r/g, '').split('\n');
        for (const line of lines) if (line) Logger.scope('AMCP').debug(line);

        this.buffer = '';
    }

    private connectListeners: (() => void)[] = [];
    protected onConnect() {
        clearTimeout(this.retryTimeout);

        this._connected = true;
        this.send(''); // Flush buffer
        this.fetchTemplates();

        for (const listener of this.connectListeners) listener();
        this.connectListeners = [];

        Logger.info('Caspar CG executor connected');
    }

    public awaitConnection() {
        return new Promise<void>((resolve, _reject) => {
            if (this.connected) return resolve();
            this.connectListeners.push(resolve);
        });
    }

    protected onDisconnect(error?: Error) {
        if (!this.client) return;

        this.client.destroy();

        this.client = null;
        this._connected = false;

        if (error) Logger.error(`Caspar CG executor failed to connect: ${error}`);
        Logger.info('Caspar CG executor disconnected');

        if (this.retryTimeout) clearTimeout(this.retryTimeout);
        if (this.retry) this.retryTimeout = setTimeout(() => this._internalConnect(), 5000);
    }

    public getEffectGroup(identifier: string, index?: number) {
        const [c, group] = identifier.split(':');

        const cid = parseInt(c);
        if (isNaN(cid)) return null;

        const channel = this.getChannel(cid);
        if (!channel) return null;

        return channel.getGroup(group, index);
    }
}