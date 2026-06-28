import net from 'net';
import { EventEmitter } from 'events';
import { Logger } from '../../util/log';

const RETRY_INTERVAL_MS = 500;
const WARN_AFTER_FAILED_ATTEMPTS = 10;
const PROBE_TIMEOUT_MS = 1000;

const log = Logger.scope('AMCP');

/**
 * AMCP TCP socket with built-in first-connect readiness probing.
 *
 * Retries the TCP connect + VERSION handshake every RETRY_INTERVAL_MS until it
 * succeeds, then emits 'ready'. Does NOT reconnect after a once-ready connection
 * drops — that is the caller's responsibility.
 *
 * Events emitted only after ready:
 *   'ready'  — VERSION probe succeeded; socket is live.
 *   'data'   — string chunk forwarded from the TCP stream.
 *   'close'  — connection dropped after having been ready.
 *   'error'  — socket error after having been ready.
 *
 * destroy() is silent — it does not emit any events.
 */
export class AmcpSocket extends EventEmitter {
    private readonly port: number;
    private readonly ip: string;

    private _ready = false;
    private _destroyed = false;
    private inner: net.Socket | null = null;
    private retryTimer: NodeJS.Timeout | null = null;
    private failedAttempts = 0;

    constructor(port: number, ip: string) {
        super();
        this.port = port;
        this.ip = ip;
    }

    get ready(): boolean {
        return this._ready;
    }

    /** Start the background first-connect loop. Tears down any prior attempt first. */
    connect(): void {
        if (this._destroyed) return;
        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
            this.retryTimer = null;
        }
        this._teardownInner();
        this._attempt();
    }

    /** Write raw AMCP data. Only meaningful after ready. */
    write(data: string): void {
        this.inner?.write(data);
    }

    /**
     * Silently tear down — stops the retry loop and destroys the inner socket.
     * Does NOT emit any events. Safe to call multiple times.
     */
    destroy(): void {
        this._destroyed = true;
        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
            this.retryTimer = null;
        }
        this._teardownInner();
    }

    private _teardownInner(): void {
        if (!this.inner) return;
        this.inner.removeAllListeners();
        this.inner.destroy();
        this.inner = null;
    }

    private _attempt(): void {
        if (this._destroyed) return;

        const sock = net.connect(this.port, this.ip);
        this.inner = sock;

        let done = false;
        const fail = (e?: Error) => {
            if (done) return;
            done = true;
            sock.removeAllListeners();
            sock.destroy();
            if (this.inner === sock) this.inner = null;
            this._onAttemptFailed(e);
        };

        sock.once('connect', () => {
            sock.removeAllListeners();
            this._probe(sock);
        });
        sock.on('error', fail);
        sock.on('close', () => fail());
    }

    private _probe(sock: net.Socket): void {
        if (this._destroyed) {
            sock.destroy();
            return;
        }

        let probeBuffer = '';
        let done = false;

        const probeTimer = setTimeout(() => {
            if (this._destroyed) return;
            fail();
        }, PROBE_TIMEOUT_MS);

        const fail = (e?: Error) => {
            if (done) return;
            done = true;
            clearTimeout(probeTimer);
            sock.removeAllListeners();
            sock.destroy();
            if (this.inner === sock) this.inner = null;
            this._onAttemptFailed(e);
        };

        const succeed = (leftover: string) => {
            if (done) return;
            done = true;
            clearTimeout(probeTimer);
            sock.removeAllListeners();

            this._ready = true;
            this.failedAttempts = 0;

            // Rewire for normal data flow; guard on _destroyed in each handler
            // so a subsequent destroy() call doesn't cause stale emissions.
            let closed = false;
            const onClose = () => {
                if (closed || this._destroyed) return;
                closed = true;
                this.emit('close');
            };
            sock.on('data', (d: Buffer | string) => {
                if (!this._destroyed) this.emit('data', d.toString());
            });
            sock.on('end', onClose);
            sock.on('close', onClose);
            sock.on('error', (e: Error) => {
                if (!this._destroyed) this.emit('error', e);
            });

            this.emit('ready');
            if (leftover) this.emit('data', leftover);
        };

        sock.on('data', (chunk: Buffer | string) => {
            probeBuffer += chunk.toString();
            const consumed = parseAmcpResponse(probeBuffer);
            if (consumed !== null) succeed(probeBuffer.slice(consumed));
        });
        sock.on('error', (e: Error) => fail(e));
        sock.on('close', () => fail());
        sock.on('end', () => fail());

        sock.write('VERSION\r\n');
    }

    private _onAttemptFailed(error?: Error): void {
        if (this._destroyed) return;
        this.failedAttempts++;
        if (this.failedAttempts === WARN_AFTER_FAILED_ATTEMPTS) {
            log.warn(
                `AMCP socket still cannot connect after ${this.failedAttempts} attempts${error ? `: ${error.message}` : ''}`,
            );
        }
        this.retryTimer = setTimeout(() => this._attempt(), RETRY_INTERVAL_MS);
    }
}

/**
 * Returns the number of bytes consumed by a complete AMCP response,
 * or null if more data is needed.
 *
 * AMCP response shapes:
 *   200  — multi-line data, terminated by a blank line
 *   201  — single data line follows the status line
 *   202+ — just the status line (no data)
 */
function parseAmcpResponse(buf: string): number | null {
    const lines: { text: string; end: number }[] = [];
    let pos = 0;
    while (pos < buf.length) {
        const idx = buf.indexOf('\r\n', pos);
        if (idx === -1) break;
        lines.push({ text: buf.slice(pos, idx), end: idx + 2 });
        pos = idx + 2;
    }

    if (lines.length === 0) return null;

    const code = parseInt(lines[0].text.slice(0, 3), 10);
    if (isNaN(code)) return null;

    if (code === 200) {
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].text === '') return lines[i].end;
        }
        return null;
    }

    if (code === 201) return lines.length >= 2 ? lines[1].end : null;

    return lines[0].end;
}
