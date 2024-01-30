import {CommandExecutor} from '../amcp/executor';
import net from 'net';

export class CasparExecutor extends CommandExecutor {
    private client: net.Socket;
    public connected: boolean = false;

    public readonly ip: string;
    public readonly port: number;

    constructor(port?: number, ip?: string) {
        super();

        this.ip = ip ?? '127.0.0.1';
        this.port = port ?? 5250;
    }

    public connect() {
        if (this.client) this.client.destroy();

        this.client = net.connect(this.port, this.ip, () => this.onConnect());

        this.client.on('end', () => this.onDisconnect());
        this.client.on('error', () => this.onDisconnect());

        let responseBuffer = '';
        this.client.on('data', d => responseBuffer = this.receive(responseBuffer + d.toString()));
    }

    public disconnect() {
        if (this.client) this.client.destroy();
        this.onDisconnect();
    }

    protected send(data: string) {
        this.client.write(data);
    }

    protected onConnect() {
        this.connected = true;
        this.fetchTemplates();
    }

    protected onDisconnect() {
        this.connected = false;
    }
}