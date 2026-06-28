import { CommandExecutor } from '@lappis/cg-manager';
import { noTry } from 'no-try';
import { Logger } from '../../util/log';
import { getTemplatesWithContent } from '../scanner/scanner';
import { AmcpSocket } from './amcp-socket';

// Circuit-breaker for bounce(): if AMCP errors keep firing — e.g. a route
// command repeatedly fails — the reconnect handler re-runs the same failing
// path and the loop becomes a tight cycle. Cap to BOUNCE_MAX bounces inside
// BOUNCE_WINDOW_MS; beyond that we drop bounce requests until the rate
// subsides, which lets the loop unwind without taking the manager down.
const BOUNCE_WINDOW_MS = 10_000;
const BOUNCE_MAX = 5;

export class CasparExecutor extends CommandExecutor {
    private socket: AmcpSocket | null = null;
    private responseBuffer = '';
    private _connected: boolean = false;

    public readonly ip: string;
    public readonly port: number;

    private retry = true;
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
        this.retry = true;
        if (this.socket) {
            this.socket.destroy();
            this.socket = null;
        }
        this.responseBuffer = '';

        const sock = new AmcpSocket(this.port, this.ip);
        this.socket = sock;

        sock.on('ready', () => this.handleReady());
        sock.on('data', (d: string) => {
            this.responseBuffer = this.receive(this.responseBuffer + d);
        });
        sock.on('close', () => this.onDisconnect());
        sock.on('error', (e: Error) => this.onDisconnect(e));

        sock.connect();
    }

    public disconnect() {
        this.retry = false;
        this.onDisconnect();
    }

    protected send(data: string) {
        if (!this.socket?.ready) {
            this.buffer += data;
            return;
        }
        if (this.buffer) data = this.buffer + data;
        this.socket.write(data);

        const lines = data.replace(/\r/g, '').split('\n');
        for (const line of lines) if (line) Logger.scope('AMCP').debug(line);

        this.buffer = '';
    }

    private connectListeners: (() => void)[] = [];
    private connectHandlers: Array<() => void> = [];

    protected handleReady() {
        const isReconnect = this.hasConnectedBefore;
        this.hasConnectedBefore = true;
        // Stamp before marking connected so the base-class promise() timeout
        // re-arms for any commands buffered pre-connect, giving them a full 1 s
        // window from this moment rather than from when they were enqueued.
        this._connectedAt = Date.now();
        this._connected = true;
        this.fetchTemplates();

        Logger.info(
            `Caspar CG executor ${isReconnect ? 'reconnected' : 'connected'}`,
        );

        this.send(''); // flush any pre-connect buffered commands
        this.dispatchConnect(isReconnect);
    }

    private dispatchConnect(isReconnect: boolean) {
        // Snapshot before dispatch so a handler that subscribes/unsubscribes
        // mid-iteration doesn't disturb the loop. connectHandlers fire on
        // every connect (first boot included); reconnectListeners only after
        // a prior connection was lost.
        for (const listener of this.connectListeners) listener();
        this.connectListeners = [];
        this.dispatch(this.connectHandlers);
        if (isReconnect) this.dispatch(this.reconnectListeners);
    }

    private dispatch(handlers: Array<() => void>) {
        for (const handler of handlers.slice()) {
            const [err] = noTry(() => handler());
            if (err) Logger.error(err as Error);
        }
    }

    /**
     * Subscribe to AMCP connect events. Unlike onReconnect, the handler fires
     * on every successful connection including the first boot connect. Returns
     * an unsubscribe function.
     */
    public onConnect(handler: () => void): () => void {
        this.connectHandlers.push(handler);
        return () => {
            const i = this.connectHandlers.indexOf(handler);
            if (i >= 0) this.connectHandlers.splice(i, 1);
        };
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

    protected onDisconnect(_error?: Error) {
        if (!this.socket) return;

        this.socket.destroy();
        this.socket = null;

        const wasConnected = this._connected;
        this._connected = false;

        // Discard buffered commands and reject pending listeners so awaiting
        // callers unblock and state is clean for the reconnect handlers.
        this.buffer = '';
        this.clearPendingCommands();

        if (wasConnected) {
            Logger.info('Caspar CG executor disconnected');
        }

        // When a ready connection drops unexpectedly, reconnect by creating a
        // fresh AmcpSocket that retries until ready. An intentional disconnect()
        // sets retry=false first, and destroy() is silent, so neither re-enters here.
        if (this.retry && wasConnected) this.connect();
    }

    public getEffectGroup(identifier: string, index?: number) {
        const [c, group] = identifier.split(':');

        const cid = parseInt(c);
        if (isNaN(cid)) return null;

        const channel = this.getChannel(cid);
        if (!channel) return null;

        return channel.getGroup(group, index);
    }

    // CasparCG may not be running (dev on macOS, or pre-boot). The parent's
    // getChannel returns undefined for unallocated channels, which crashes
    // plugins that assume the Channel is always there. Lazy-allocate so
    // plugins get a real Channel object; commands it issues go through the
    // executor's buffered send() and are dropped on the next disconnect tick.
    public getChannel(casparChannel: number) {
        let channel = super.getChannel(casparChannel);
        if (!channel) {
            Logger.scope('AMCP').warn(
                `Channel ${casparChannel} not allocated — lazy-allocating ` +
                    '(Caspar likely offline).',
            );
            channel = this.allocateChannel(casparChannel);
        }
        return channel;
    }

    private bounceTimestamps: number[] = [];

    /**
     * Drop the current AMCP socket and immediately try to re-establish it.
     * Used by the global unhandled-rejection trap when a CasparResponseError
     * escapes plugin code — bouncing the connection puts host-side state
     * back in sync (effects re-init on reconnect) without taking the manager
     * down. Rate-limited so a persistently failing AMCP path can't drive a
     * tight bounce ↔ reconnect ↔ refresh ↔ AMCP-error loop.
     */
    public bounce() {
        const now = Date.now();
        this.bounceTimestamps = this.bounceTimestamps.filter(
            t => now - t < BOUNCE_WINDOW_MS,
        );
        if (this.bounceTimestamps.length >= BOUNCE_MAX) {
            Logger.scope('AMCP').error(
                `AMCP bounce rate-limited (${BOUNCE_MAX} in ${BOUNCE_WINDOW_MS / 1000}s) — ` +
                    'something is causing repeated errors; suppressing this bounce.',
            );
            return;
        }
        this.bounceTimestamps.push(now);

        this.disconnect();
        this.connect();
    }
}
