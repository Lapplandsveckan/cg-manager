import {CommandExecutor} from '../amcp/executor';
import net from 'net';
import {Logger} from '../../util/log';
import {getTemplatesWithContent} from '../scanner/scanner';

export class CasparExecutor extends CommandExecutor {
    private client: net.Socket;
    public connected: boolean = false;

    public readonly ip: string;
    public readonly port: number;

    private retryTimeout: NodeJS.Timeout;
    private retry = true;

    protected _fetchTemplates(): Promise<any[]> {
        return getTemplatesWithContent();
    }

    constructor(port?: number, ip?: string) {
        super();

        this.ip = ip ?? '127.0.0.1';
        this.port = port ?? 5250;
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
        this.client.write(data);
    }

    protected onConnect() {
        clearTimeout(this.retryTimeout);

        this.connected = true;
        this.fetchTemplates();

        Logger.info('Caspar CG executor connected');
    }

    protected onDisconnect(error?: Error) {
        if (!this.client) return;

        this.client.destroy();

        this.client = null;
        this.connected = false;

        if (error) Logger.error(`Caspar CG executor failed to connect: ${error}`);
        Logger.info('Caspar CG executor disconnected');

        if (this.retryTimeout) clearTimeout(this.retryTimeout);
        if (this.retry) this.retryTimeout = setTimeout(() => this._internalConnect(), 5000);
    }

    public getEffect(effect: string) {
        return this.getChannels()
            .map(channel => channel.groups.map(group => group.effects))
            .flat(2)
            .find(e => e.id === effect);
    }
}