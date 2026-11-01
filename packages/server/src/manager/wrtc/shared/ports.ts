import net from 'net';
import dgram from 'dgram';
import { type EventEmitter } from 'events';

const LOOPBACK = '127.0.0.1';

function awaitBind(
    source: EventEmitter,
    bind: (done: () => void) => void,
): Promise<void> {
    return new Promise((resolve, reject) => {
        source.once('error', reject);
        bind(() => {
            source.removeListener('error', reject);
            resolve();
        });
    });
}

/** Bound before the AMCP ADD so CasparCG can never connect to a not-yet-bound port (Linux 'Connection refused' race). */
export async function listenTcp(): Promise<{
    server: net.Server;
    port: number;
}> {
    const server = net.createServer();
    await awaitBind(server, done => server.listen(0, LOOPBACK, done));

    return { server, port: (server.address() as net.AddressInfo).port };
}

export async function bindUdp(): Promise<{
    socket: dgram.Socket;
    port: number;
}> {
    const socket = dgram.createSocket('udp4');
    await awaitBind(socket, done => socket.bind(0, LOOPBACK, done));

    return { socket, port: socket.address().port };
}

/** For ports somebody else binds (ffmpeg, CasparCG) and therefore has to be told
 *  up front — `bindUdp`'s ephemeral port can't be communicated in advance. */
export class PortPool {
    private used = new Set<number>();

    public constructor(
        private base: number,
        private size: number,
    ) {}

    public claim(count: number): number[] {
        const claimed: number[] = [];
        for (let port = this.base; port < this.base + this.size; port++) {
            if (this.used.has(port)) continue;

            this.used.add(port);
            claimed.push(port);
            if (claimed.length === count) return claimed;
        }

        this.release(claimed);
        throw new Error(
            `No free loopback ports in ${this.base}-${this.base + this.size - 1}`,
        );
    }

    public release(ports: number[]): void {
        for (const port of ports) this.used.delete(port);
    }
}
