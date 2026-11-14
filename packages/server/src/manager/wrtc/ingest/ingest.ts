import type dgram from 'dgram';
import { EventEmitter } from 'events';
import {
    type IngestApi,
    type IngestSession,
    type IngestSessionEvent,
    type IngestSessionHandler,
    type ShareLink,
    type ShareLinkInput,
} from '@lappis/cg-manager';
import { noTry, noTryAsync } from 'no-try';
import { type RTCPeerConnection } from 'werift';
import managerConfig from '../../../util/config';
import { Logger } from '../../../util/log';
import { UUID } from '../../../util/uuid';
import { dtlsKeys } from '../shared/dtls';
import { PortPool } from '../shared/ports';
import { clearStaleSdp, type Pipeline } from './pipeline';
import { buildSession } from './session';
import { DEFAULT_SINK, sinkById } from './sinks';
import { ShareStore } from './shares';

const logger = Logger.scope('Ingest');

/** Video RTP, audio RTP and the sink CasparCG reads, each RTP port followed by
 *  a reserved one: libavformat binds RTP+1 for RTCP, so packing them
 *  consecutively made the audio line fail to bind. */
const PORTS_PER_SESSION = 5;
const VIDEO_PORT_OFFSET = 0;
const AUDIO_PORT_OFFSET = 2;
const SINK_PORT_OFFSET = 4;

/** One scaled-down JPEG from the sender. Generous for a 320px frame, small
 *  enough that a share link can't be used to park megabytes in memory. */
export const MAX_THUMBNAIL_BYTES = 256 * 1024;

const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

/** A peer that never sends a packet would otherwise hold its ports and its
 *  ffmpeg forever: werift answers even an offer with no transport at all, so
 *  `connectionStateChange` never reports a failure to clean up after. */
const CONNECT_TIMEOUT_MS = 30_000;

interface InternalSession extends IngestSession {
    pc: RTCPeerConnection;
    rtpSocket: dgram.Socket;
    pipeline: Pipeline;
    stopKeyframeRequests: () => void;
    ports: number[];
    closed: boolean;
    timer?: NodeJS.Timeout;
    thumbnail?: Buffer;
}

export interface OpenSessionOptions {
    sdpOffer: string;
    shareId?: string | null;
    label?: string;
    allowAudio?: boolean;
}

const publicSession = (session: InternalSession): IngestSession => ({
    id: session.id,
    label: session.label,
    url: session.url,
    state: session.state,
    hasVideo: session.hasVideo,
    hasAudio: session.hasAudio,
    startedAt: session.startedAt,
    shareId: session.shareId,
});

export class IngestManager extends EventEmitter implements IngestApi {
    private sessions = new Map<string, InternalSession>();
    private reserving = new Map<string, string | null>();
    private shares = new ShareStore();
    private pool: PortPool;

    public constructor() {
        super();

        const base = managerConfig['ingest-port-base'];
        this.pool = new PortPool(
            base,
            managerConfig['ingest-max-sessions'] * PORTS_PER_SESSION,
        );

        // Same warm-up as preview: generating keys per session showed up in setup time.
        dtlsKeys();
    }

    public async load(): Promise<void> {
        await clearStaleSdp();
        await this.shares.load();
    }

    public listShares(): ShareLink[] {
        return this.shares.list();
    }

    public getShare(id: string): ShareLink | null {
        return this.shares.get(id);
    }

    /** The shape every reader wants — and the one the broadcast must send, or
     *  clients patching from it would drop `path`. */
    public listSharesWithPath(): Array<ShareLink & { path: string | null }> {
        return this.shares
            .list()
            .map(share => ({ ...share, path: this.sharePath(share.id) }));
    }

    public shareByToken(token: string): ShareLink | null {
        return this.shares.byToken(token);
    }

    public async createShare(
        data: Partial<ShareLinkInput>,
    ): Promise<ShareLink> {
        const share = await this.shares.create(data);
        this.emit('shares');

        return share;
    }

    public async revokeShare(id: string): Promise<void> {
        if (!(await this.shares.remove(id))) return;

        const orphaned = this.list().filter(s => s.shareId === id);
        await Promise.all(orphaned.map(s => this.closeSession(s.id)));
        this.emit('shares');
    }

    public sharePath(id: string): string | null {
        const share = this.shares.get(id);
        if (!share) return null;

        return `/share/${share.token}`;
    }

    public listSessions(): IngestSession[] {
        return this.list().map(publicSession);
    }

    public getSession(id: string): IngestSession | null {
        const session = this.sessions.get(id);

        return session ? publicSession(session) : null;
    }

    /** Frames come from whoever is sending the stream — see
     *  `web/src/lib/captureThumbnails.ts` for why the host doesn't make them.
     *  Lives and dies with the session, like the rest of its state. */
    public setThumbnail(id: string, data: Buffer): boolean {
        const session = this.sessions.get(id);
        if (!session || session.closed) return false;
        if (data.length > MAX_THUMBNAIL_BYTES) return false;

        // Guest-supplied bytes get served back to an operator's browser from
        // our own origin, so take nothing on trust but a real JPEG header.
        if (!data.subarray(0, JPEG_MAGIC.length).equals(JPEG_MAGIC))
            return false;

        session.thumbnail = data;
        return true;
    }

    public getThumbnail(id: string): Buffer | null {
        return this.sessions.get(id)?.thumbnail ?? null;
    }

    /** Which share a session came in on, for checking a guest only writes to
     *  sessions its own link opened. */
    public shareIdOf(id: string): string | null {
        return this.sessions.get(id)?.shareId ?? null;
    }

    public onSession(handler: IngestSessionHandler): () => void {
        this.on('session', handler);

        return () => this.off('session', handler);
    }

    public offSession(handler: IngestSessionHandler): void {
        this.off('session', handler);
    }

    /** Mirror of the preview path: a werift peer that *receives* a browser
     *  track and hands its RTP to ffmpeg, which remuxes to a URL CasparCG plays. */
    public async openSession(
        opts: OpenSessionOptions,
    ): Promise<{ id: string; sdpAnswer: string }> {
        if (!/^m=video /m.test(opts.sdpOffer))
            throw new Error('Offer carries no video track');

        const sink = sinkById(DEFAULT_SINK);
        if (!sink) throw new Error(`Unknown ingest sink ${DEFAULT_SINK}`);

        const wantsAudio =
            opts.allowAudio !== false && /^m=audio /m.test(opts.sdpOffer);
        const id = UUID.generate();

        // Reserved before any await: concurrent offers would otherwise all pass
        // the caps and only be stopped by the port pool running dry.
        this.reserve(id, opts.shareId ?? null);

        const [err, opened] = await noTryAsync(async () => {
            const ports = this.pool.claim(PORTS_PER_SESSION);
            const plan = {
                sink,
                wantsAudio,
                videoPort: ports[VIDEO_PORT_OFFSET],
                audioPort: ports[AUDIO_PORT_OFFSET],
                sinkPort: ports[SINK_PORT_OFFSET],
                stunServer:
                    managerConfig['ingest-stun'] ??
                    managerConfig['preview-stun'],
            };

            const [buildErr, built] = await noTryAsync(() =>
                buildSession(id, opts.sdpOffer, plan, {
                    onFirstPacket: () => this.markLive(id),
                    onPipelineExit: () => this.onPipelineExit(id),
                }),
            );
            if (buildErr) {
                this.pool.release(ports);
                throw buildErr;
            }

            return { ports, plan, ...built };
        });

        this.reserving.delete(id);
        if (err) throw err;

        const session: InternalSession = {
            id,
            label: opts.label ?? 'Screen share',
            shareId: opts.shareId ?? null,
            url: sink.url(opened.plan.sinkPort),
            state: 'connecting',
            hasVideo: true,
            hasAudio: wantsAudio,
            startedAt: Date.now(),
            ports: opened.ports,
            closed: false,
            ...opened.handles,
        };

        session.timer = setTimeout(() => {
            logger.warn(`Ingest ${id} never went live — closing`);
            this.closeSession(id).catch(() => {
                /* already torn down */
            });
        }, CONNECT_TIMEOUT_MS);

        this.sessions.set(id, session);
        this.watch(session);
        this.emitSession('open', session);

        logger.debug(
            `Opened ingest ${id} video=${opened.plan.videoPort} audio=` +
                `${wantsAudio ? opened.plan.audioPort : 'none'} ` +
                `sink=${opened.plan.sinkPort}`,
        );

        return { id, sdpAnswer: opened.sdpAnswer };
    }

    /** Live plus still-negotiating sessions attributed to a share. */
    private countFor(shareId: string | null): number {
        const live = this.list().filter(s => s.shareId === shareId).length;
        const reserved = Array.from(this.reserving.values()).filter(
            id => id === shareId,
        ).length;

        return live + reserved;
    }

    private reserve(id: string, shareId: string | null): void {
        const max = managerConfig['ingest-max-sessions'];
        if (this.sessions.size + this.reserving.size >= max)
            throw new Error(`Already ingesting ${max} shares`);

        const share = shareId ? this.shares.get(shareId) : null;
        if (share && this.countFor(shareId) >= share.maxSessions)
            throw new Error(`Share "${share.label}" is already in use`);

        this.reserving.set(id, shareId);
    }

    private onPipelineExit(id: string): void {
        this.closeSession(id).catch(() => {
            /* already torn down */
        });
    }

    public async closeSession(id: string): Promise<void> {
        const session = this.sessions.get(id);
        if (!session || session.closed) return;

        session.closed = true;
        session.state = 'closed';
        clearTimeout(session.timer);
        this.sessions.delete(id);

        session.stopKeyframeRequests();
        await noTryAsync(() => session.pc.close());
        noTry(() => session.rtpSocket.close());
        await noTryAsync(() => session.pipeline.close());
        this.pool.release(session.ports);

        this.emitSession('close', session);
        logger.debug(`Closed ingest ${id}`);
    }

    public async disposeAll(): Promise<void> {
        await Promise.all(this.list().map(s => this.closeSession(s.id)));
    }

    private list(): InternalSession[] {
        return Array.from(this.sessions.values());
    }

    /** Contained: a throwing subscriber must not abort the session lifecycle
     *  that is emitting the event. */
    private emitSession(
        type: IngestSessionEvent['type'],
        session: InternalSession,
    ): void {
        const [err] = noTry(() =>
            this.emit('session', { type, session: publicSession(session) }),
        );
        if (err) logger.warn(`session listener threw: ${err.message}`);
    }

    private markLive(id: string): void {
        const session = this.sessions.get(id);
        if (session?.state !== 'connecting') return;

        clearTimeout(session.timer);
        session.state = 'live';
        this.emitSession('update', session);
    }

    private watch(session: InternalSession): void {
        // Peer connection close tears everything down; no DELETE endpoint.
        session.pc.connectionStateChange.subscribe(state => {
            if (
                state !== 'closed' &&
                state !== 'failed' &&
                state !== 'disconnected'
            )
                return;

            this.closeSession(session.id).catch(e =>
                logger.warn(`close failed: ${(e as Error).message}`),
            );
        });
    }
}
