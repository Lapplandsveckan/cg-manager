import net from 'net';
import {Logger} from '../../util/log';
import {getTemplatesWithContent} from '../scanner/scanner';
import {Command, CommandExecutor} from '@lappis/cg-manager';

// AMCP socket usually accepts within a few hundred ms of CasparCG starting,
// so retry briefly while it warms up and only surface a warning if it stays
// down for longer than that.
const RETRY_INTERVAL_MS = 500;
const WARN_AFTER_FAILED_ATTEMPTS = 10;

export class CasparExecutor extends CommandExecutor {
    private client: net.Socket;
    private _connected: boolean = false;

    public readonly ip: string;
    public readonly port: number;

    private retryTimeout: NodeJS.Timeout;
    private retry = true;
    private failedAttempts = 0;
    private buffer = '';
    private hasConnectedBefore = false;
    private reconnectListeners: Array<() => void> = [];

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
        if (this.retryTimeout) clearTimeout(this.retryTimeout);
        this.retry = true;
        this.failedAttempts = 0;
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

        const isReconnect = this.hasConnectedBefore;
        this.hasConnectedBefore = true;
        this._connected = true;
        this.failedAttempts = 0;
        this.send(''); // Flush buffer
        this.fetchTemplates();

        for (const listener of this.connectListeners) listener();
        this.connectListeners = [];

        Logger.info(`Caspar CG executor ${isReconnect ? 'reconnected' : 'connected'}`);

        if (isReconnect) {
            // Snapshot the listener list so a handler that subscribes/
            // unsubscribes during dispatch doesn't disturb iteration.
            const handlers = this.reconnectListeners.slice();
            for (const handler of handlers) 
                try { handler(); } catch (e) { Logger.error(e as Error); }
            
        }
    }

    public awaitConnection() {
        return new Promise<void>((resolve, _reject) => {
            if (this.connected) return resolve();
            this.connectListeners.push(resolve);
        });
    }

    /**
     * Subscribe to AMCP reconnect events. The handler fires whenever the
     * executor re-establishes a socket to CasparCG *after* having lost one —
     * i.e. when CasparCG has restarted. The first connection on boot does
     * NOT trigger this. Returns an unsubscribe function.
     */
    public onReconnect(handler: () => void): () => void {
        this.reconnectListeners.push(handler);
        return () => {
            const i = this.reconnectListeners.indexOf(handler);
            if (i >= 0) this.reconnectListeners.splice(i, 1);
        };
    }

    protected onDisconnect(error?: Error) {
        if (!this.client) return;

        this.client.destroy();
        this.client = null;

        const wasConnected = this._connected;
        this._connected = false;

        // Any buffered commands belong to the pre-disconnect state, and
        // CasparCG has just forgotten everything anyway. Discard them so the
        // reconnect-handlers can replay state from scratch without old AMCP
        // strings being flushed first.
        this.buffer = '';

        if (wasConnected)
            Logger.info('Caspar CG executor disconnected');
        else if (this.retry) {
            this.failedAttempts++;
            if (this.failedAttempts === WARN_AFTER_FAILED_ATTEMPTS)
                Logger.warn(`Caspar CG executor still cannot connect after ${this.failedAttempts} attempts${error ? `: ${error}` : ''}`);
        }

        if (this.retryTimeout) clearTimeout(this.retryTimeout);
        if (this.retry) this.retryTimeout = setTimeout(() => this._internalConnect(), RETRY_INTERVAL_MS);
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