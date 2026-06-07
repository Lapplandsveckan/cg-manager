import dgram from 'dgram';
import os from 'os';
import { noTry } from 'no-try';
import config from '../util/config';
import { Logger } from '../util/log';

/**
 * LAN discovery beacon. Periodically broadcasts a JSON announcement so
 * clients on the same subnet can find the manager without DNS / mDNS.
 *
 * Replaces a previous Bonjour/mDNS-based scheme that was fragile across
 * operating systems and firewalls. UDP broadcast is far simpler and gives
 * us full control over the payload shape.
 *
 * Wire format: one JSON object per UDP datagram, sent every
 * `BEACON_INTERVAL_MS` ms. Clients should bind to UDP `BEACON_PORT` and
 * parse incoming datagrams. The `id` is regenerated on every manager
 * start, so a client can tell that the manager restarted.
 */
const BEACON_PORT = 5354;
const BEACON_INTERVAL_MS = 2000;
const BEACON_TYPE = 'cg-manager';

const logger = Logger.scope('Discovery');

interface BeaconPayload {
    type: typeof BEACON_TYPE;
    id: string;
    name: string;
    port: number;
    version: string;
    t: number;
}

function readVersion(): string {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const [, pkg] = noTry(() => require('../../package.json'));
    return (pkg as { version?: string } | undefined)?.version ?? '0.0.0';
}

function broadcastAddress(ip: string, netmask: string): string | null {
    const [ipErr, ipParts] = noTry(() =>
        ip.split('.').map(p => {
            const n = Number(p);
            if (!Number.isInteger(n) || n < 0 || n > 255)
                throw new Error('bad octet');
            return n;
        }),
    );
    const [maskErr, maskParts] = noTry(() =>
        netmask.split('.').map(p => {
            const n = Number(p);
            if (!Number.isInteger(n) || n < 0 || n > 255)
                throw new Error('bad octet');
            return n;
        }),
    );
    if (ipErr || maskErr || ipParts.length !== 4 || maskParts.length !== 4)
        return null;
    return ipParts.map((p, i) => p | (~maskParts[i] & 0xff)).join('.');
}

function broadcastTargets(): string[] {
    const targets = new Set<string>(['255.255.255.255']);
    for (const list of Object.values(os.networkInterfaces())) {
        if (!list) continue;
        for (const iface of list) {
            if (iface.family !== 'IPv4' || iface.internal) continue;
            const addr = broadcastAddress(iface.address, iface.netmask);
            if (addr) targets.add(addr);
        }
    }
    return [...targets];
}

export class Discovery {
    private socket: dgram.Socket | null = null;
    private timer: NodeJS.Timeout | null = null;
    private readonly id = Math.random().toString(36).substring(2, 10);
    private readonly version = readVersion();

    async start(): Promise<void> {
        const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

        await new Promise<void>((resolve, reject) => {
            socket.once('error', reject);
            // Bind to an ephemeral port — we're the sender, not a listener.
            // Without bind(), `setBroadcast` would still need an open
            // descriptor; this also lets us hear back if we ever want
            // a query/response variant later.
            socket.bind(0, () => {
                socket.removeListener('error', reject);
                socket.setBroadcast(true);
                resolve();
            });
        });

        socket.on('error', err =>
            logger.warn(`beacon socket error: ${err.message}`),
        );
        this.socket = socket;

        this.broadcast();
        this.timer = setInterval(() => this.broadcast(), BEACON_INTERVAL_MS);

        logger.info(
            `Broadcasting beacon on UDP :${BEACON_PORT} every ${BEACON_INTERVAL_MS}ms`,
        );
    }

    async stop(): Promise<void> {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;

        const socket = this.socket;
        this.socket = null;
        if (!socket) return;

        await new Promise<void>(resolve => socket.close(() => resolve()));
    }

    private broadcast() {
        const socket = this.socket;
        if (!socket) return;

        const payload: BeaconPayload = {
            type: BEACON_TYPE,
            id: this.id,
            name: os.hostname(),
            port: config.port,
            version: this.version,
            t: Date.now(),
        };
        const buf = Buffer.from(JSON.stringify(payload), 'utf8');

        for (const target of broadcastTargets()) {
            const [err] = noTry(() => socket.send(buf, BEACON_PORT, target));
            // ENETUNREACH on a transient interface (VPN dropping etc.) is
            // expected; log at debug so we don't spam during reconnects.
            if (err)
                logger.debug(`beacon send to ${target} failed: ${err.message}`);
        }
    }
}
