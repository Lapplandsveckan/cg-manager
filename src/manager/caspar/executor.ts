import {CommandExecutor} from '../amcp/executor';
import net from 'net';
import {Logger} from "../../util/log";

export class CasparExecutor extends CommandExecutor {
    private client: net.Socket;
    public connected: boolean = false;

    public readonly ip: string;
    public readonly port: number;

    private retryTimeout: NodeJS.Timeout;
    private retry = true;

    constructor(port?: number, ip?: string) {
        super();

        this.ip = ip ?? '127.0.0.1';
        this.port = port ?? 5250;
    }

    public connect() {
        if (this.client) this.client.destroy();

        this.client = net.connect(this.port, this.ip, () => this.onConnect());

        this.client.on('end', () => this.onDisconnect());
        this.client.on('error', e => this.onDisconnect(e));

        let responseBuffer = '';
        this.client.on('data', d => responseBuffer = this.receive(responseBuffer + d.toString()));
    }

    public disconnect() {
        if (this.client) this.client.destroy();
        this.onDisconnect();

        this.retry = false;
    }

    protected send(data: string) {
        this.client.write(data);
    }

    protected onConnect() {
        clearTimeout(this.retryTimeout);

        this.connected = true;
        this.retry = true;
        this.fetchTemplates();

        Logger.info('Caspar CG executor connected');
    }

    protected onDisconnect(error?: Error) {
        this.connected = false;

        Logger.info('Caspar CG executor disconnected');
        if (error) Logger.error(error);

        if (this.retryTimeout) clearTimeout(this.retryTimeout);
        this.retryTimeout = setTimeout(() => this.connect(), 5000);
    }
}