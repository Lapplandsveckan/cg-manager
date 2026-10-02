import { CommandExecutor } from '@lappis/cg-manager';
import { noTry } from 'no-try';
import { Logger } from '../../util/log';
import { breadcrumbAmcp } from '../../util/telemetry';
import {
    getTemplatesWithContent,
    type TemplateInfo,
} from '../scanner/templates';
import { AmcpSocket, type AmcpTransport } from './amcp-socket';

// Caps one AMCP line in a breadcrumb (a 400's echoed command or CG ADD payload can be long).
const AMCP_BREADCRUMB_LINE_LIMIT = 200;

const truncateAmcpLine = (line: string): string =>
    line.length > AMCP_BREADCRUMB_LINE_LIMIT
        ? `${line.slice(0, AMCP_BREADCRUMB_LINE_LIMIT)}…`
        : line;

// Circuit breaker: drops bounce requests beyond BOUNCE_MAX per BOUNCE_WINDOW_MS so a failing path cannot loop.
const BOUNCE_WINDOW_MS = 10_000;
const BOUNCE_MAX = 5;

// Periodically compacts layer holes left by effect churn so layer numbers do not creep upward.
const COMPACTION_INTERVAL_MS = 60_000;

export class CasparExecutor extends CommandExecutor {
    private socket: AmcpTransport | null = null;
    private responseBuffer = '';
    private _connected: boolean = false;

    public readonly ip: string;
    public readonly port: number;

    private retry = true;
    private buffer = '';
    private hasConnectedBefore = false;
    private reconnectListeners: Array<() => void> = [];
    private compactionTimer: NodeJS.Timeout | null = null;

    protected _fetchTemplates(): Promise<TemplateInfo[]> {
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

    public startCompaction() {
        this.stopCompaction();
        this.compactionTimer = setInterval(
            () => this.compactChannels(),
            COMPACTION_INTERVAL_MS,
        );
    }

    public stopCompaction() {
        if (this.compactionTimer) clearInterval(this.compactionTimer);
        this.compactionTimer = null;
    }

    private compactChannels() {
        if (!this.connected) return; // commands would just be buffered/dropped
        const channels = this.getChannels();
        if (channels.length === 0) return;

        const [err] = noTry(() => {
            for (const channel of channels) channel.compact();
            this.executeAllocations(); // emits the SWAPs for the new order
        });
        if (err)
            Logger.scope('AMCP').warn(
                `Layer compaction failed: ${err.message}`,
            );
    }

    protected createSocket(): AmcpTransport {
        return new AmcpSocket(this.port, this.ip);
    }

    public connect() {
        this.retry = true;
        if (this.socket) {
            this.socket.destroy();
            this.socket = null;
        }
        this.responseBuffer = '';

        const sock = this.createSocket();
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
        for (const line of lines) {
            if (!line) continue;
            Logger.scope('AMCP').debug(line);
            breadcrumbAmcp(`→ ${truncateAmcpLine(line)}`);
        }

        this.buffer = '';
    }

    // Skips 1xx/2xx: their bodies (CLS/TLS dumps) are not the trail. A non-2xx carries at most data[0].
    protected onEvent(code: number, cmd: string, data: string[]) {
        super.onEvent(code, cmd, data);
        if (!Number.isFinite(code) || code < 300) return;

        const header = cmd ? `${code} ${cmd}` : `${code}`;
        const detail = data[0] ? `: ${truncateAmcpLine(data[0])}` : '';
        breadcrumbAmcp(`← ${header}${detail}`, 'warning');
    }

    private connectListeners: (() => void)[] = [];
    private connectHandlers: Array<() => void> = [];

    protected handleReady() {
        const isReconnect = this.hasConnectedBefore;
        this.hasConnectedBefore = true;
        // Stamp before marking connected so buffered commands get a full 1 s timeout from now.
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
        // Snapshot so handlers can unsubscribe mid-iteration.
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

    /** Fires on every connect, first boot included. */
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

    /** Fires on every reconnect after a lost socket (CasparCG restart), not the first boot connect. */
    public onReconnect(handler: () => void): () => void {
        this.reconnectListeners.push(handler);
        return () => {
            const i = this.reconnectListeners.indexOf(handler);
            if (i >= 0) this.reconnectListeners.splice(i, 1);
        };
    }

    protected onDisconnect(error?: Error) {
        if (!this.socket) return;

        // Only set for a post-ready drop, so this fires once per lost connection. Breadcrumb only: reconnects are routine.
        if (error) {
            breadcrumbAmcp(`✕ disconnected: ${error.message}`, 'warning');
        }

        this.socket.destroy();
        this.socket = null;

        const wasConnected = this._connected;
        this._connected = false;

        this.buffer = '';
        this.clearPendingCommands();

        if (wasConnected) {
            Logger.info('Caspar CG executor disconnected');
        }

        // Reconnect with a fresh retrying socket; an intentional disconnect() sets retry=false first.
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

    public getEffectGroups() {
        return this.getChannels().map(channel => {
            const { channel: num, groups } = channel.toJSON();
            return { channel: num, groups };
        });
    }

    public findEffectGroup(identifier: string) {
        const [c, name] = identifier.split(':');
        const cid = parseInt(c);
        if (isNaN(cid) || !name) return null;

        const channel = this.getChannels().find(
            ch => ch.toJSON().channel === cid,
        );
        const group = channel?.groups.find(g => g.name === name);
        if (!channel || !group) return null;

        return { channel: cid, ...group.toJSON() };
    }

    // Lazy-allocate: without CasparCG, getChannel returns undefined and crashes plugins.
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

    /** Rebuilds the AMCP socket after a stray CasparResponseError; rate-limited to prevent a bounce/reconnect loop. */
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
