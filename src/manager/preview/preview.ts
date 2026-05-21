import net from 'net';
import {BasicCommand} from '@lappis/cg-manager';
import {Logger} from '../../util/log';
import {CasparExecutor} from '../caspar/executor';

const logger = Logger.scope('Preview');

// Consumer slot index for preview sessions starts well above the typical
// statically-configured consumers (which sit at 1..N from the XML). Each
// new session bumps the counter; CasparCG only cares about uniqueness
// within a channel but we make it globally unique for easier tracking.
let nextConsumerIndex = 100;

export interface PreviewSessionOptions {
    channel: number;
    /**
     * ffmpeg args appended after the STREAM URL. Drives the output
     * muxer/codec — e.g. `['-f', 'mpjpeg', '-q:v', '5']` for MJPEG over HTTP,
     * or `['-f', 'mpegts', '-c:v', 'libx264', '-tune', 'zerolatency']` for
     * the WebSocket path. Pre-tokenised so `BasicCommand.construct` can
     * pass each as a separate AMCP arg.
     */
    ffmpegArgs: string[];
}

export interface PreviewSession {
    /** Subscribe to byte chunks streaming from ffmpeg. */
    onData(handler: (chunk: Buffer) => void): void;
    /**
     * Tear down: remove the AMCP consumer, close the local TCP listener,
     * drop ffmpeg's connection. Safe to call multiple times.
     */
    close(): Promise<void>;
}

interface InternalSession extends PreviewSession {
    channel: number;
    consumerIndex: number;
    server: net.Server;
    ffmpegSocket: net.Socket | null;
    handlers: ((chunk: Buffer) => void)[];
    closed: boolean;
}

export class PreviewManager {
    private sessions = new Set<InternalSession>();

    public constructor(private executor: CasparExecutor) {}

    /**
     * Open a per-client ffmpeg stream session against the given channel.
     * The caller drives the transport (HTTP, WebSocket, etc.) by attaching
     * a handler via `session.onData(...)`.
     */
    public async openSession(opts: PreviewSessionOptions): Promise<PreviewSession> {
        if (!this.executor.connected)
            throw new Error('CasparCG is not connected — start the server first');

        const consumerIndex = nextConsumerIndex++;

        // Listen on a free port (OS-picked) bound to loopback only — CasparCG
        // runs on the same machine, no reason to expose this externally.
        const server = net.createServer();
        await new Promise<void>((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', () => {
                server.removeListener('error', reject);
                resolve();
            });
        });
        const port = (server.address() as net.AddressInfo).port;
        const url = `tcp://127.0.0.1:${port}`;

        const session: InternalSession = {
            channel: opts.channel,
            consumerIndex,
            server,
            ffmpegSocket: null,
            handlers: [],
            closed: false,

            onData: (handler) => {
                session.handlers.push(handler);
            },
            close: () => this.closeSession(session),
        };

        server.on('connection', (socket) => {
            session.ffmpegSocket = socket;
            socket.on('data', (chunk) => {
                if (session.closed) return;
                for (const h of session.handlers) 
                    try { h(chunk); } catch (e) { logger.error(e as Error); }
                
            });
            socket.on('close', () => { session.ffmpegSocket = null; });
            socket.on('error', (e) => logger.warn(`ffmpeg socket error: ${e.message}`));
        });

        // The `<ch>-<consumerIndex>` syntax pins the consumer slot so REMOVE
        // later targets exactly this one. BasicCommand.construct handles
        // arg quoting + the trailing \r\n so the AMCP parser actually
        // dispatches and we get a 202 back.
        const cmd = BasicCommand.construct(
            'ADD',
            `${opts.channel}-${consumerIndex}`,
            'STREAM',
            url,
            ...opts.ffmpegArgs,
        );
        try {
            await this.executor.execute(cmd);
        } catch (e) {
            // Clean up the listener if AMCP refused the command.
            server.close();
            throw new Error(`AMCP ADD failed: ${(e as Error).message ?? e}`);
        }

        this.sessions.add(session);
        logger.debug(`Opened preview session ch=${opts.channel} idx=${consumerIndex} port=${port}`);

        return session;
    }

    private async closeSession(session: InternalSession): Promise<void> {
        if (session.closed) return;
        session.closed = true;

        this.sessions.delete(session);

        // Best-effort REMOVE — failure here is non-fatal (CasparCG might
        // already be gone) but we still want to drop our local resources.
        try {
            await this.executor.execute(
                BasicCommand.construct('REMOVE', `${session.channel}-${session.consumerIndex}`),
            );
        } catch (e) {
            logger.warn(`AMCP REMOVE failed for ${session.channel}-${session.consumerIndex}: ${(e as Error).message ?? e}`);
        }

        if (session.ffmpegSocket) session.ffmpegSocket.destroy();
        session.server.close();

        logger.debug(`Closed preview session ch=${session.channel} idx=${session.consumerIndex}`);
    }

    /** Tear down everything — used at manager shutdown. */
    public async disposeAll(): Promise<void> {
        const all = Array.from(this.sessions);
        await Promise.all(all.map((s) => this.closeSession(s)));
    }
}
