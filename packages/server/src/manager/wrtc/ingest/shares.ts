import fs from 'fs/promises';
import crypto from 'crypto';
import { type ShareLink, type ShareLinkInput } from '@lappis/cg-manager';
import { noTry, noTryAsync } from 'no-try';
import managerConfig from '../../../util/config';
import { Logger } from '../../../util/log';
import { UUID } from '../../../util/uuid';

const logger = Logger.scope('Ingest');

const DEFAULTS: ShareLinkInput = {
    label: 'Screen share',
    maxSessions: 1,
    allowAudio: true,
    expiresAt: null,
};

/** 32 hex chars of CSPRNG — the link is the only credential a guest presents. */
const mintToken = () => crypto.randomBytes(16).toString('hex');

const sameToken = (stored: string, given: string) => {
    if (stored.length !== given.length) return false;

    return crypto.timingSafeEqual(Buffer.from(stored), Buffer.from(given));
};

/** Spreading an explicit `undefined` would shadow the default behind it, which
 *  left `maxSessions` unset and the per-share cap unenforceable. */
const supplied = (data: Partial<ShareLinkInput>) =>
    Object.fromEntries(
        Object.entries(data).filter(([, value]) => value !== undefined),
    ) as Partial<ShareLinkInput>;

export class ShareStore {
    private shares = new Map<string, ShareLink>();

    public list(): ShareLink[] {
        return Array.from(this.shares.values());
    }

    public get(id: string): ShareLink | null {
        return this.shares.get(id) ?? null;
    }

    public byToken(token: string): ShareLink | null {
        if (!token) return null;

        const match = this.list().find(share => sameToken(share.token, token));
        if (!match) return null;

        return this.expired(match) ? null : match;
    }

    public expired(share: ShareLink): boolean {
        return !!share.expiresAt && share.expiresAt < Date.now();
    }

    public async create(data: Partial<ShareLinkInput>): Promise<ShareLink> {
        const share: ShareLink = {
            ...DEFAULTS,
            ...supplied(data),
            id: UUID.generate(),
            token: mintToken(),
            createdAt: Date.now(),
        };

        this.shares.set(share.id, share);
        await this.save();

        return share;
    }

    public async remove(id: string): Promise<boolean> {
        if (!this.shares.delete(id)) return false;

        await this.save();
        return true;
    }

    public async load(): Promise<void> {
        const [readErr, raw] = await noTryAsync(() =>
            fs.readFile(this.file, 'utf8'),
        );
        if (readErr) return;

        const [parseErr, parsed] = noTry(() => JSON.parse(raw) as ShareLink[]);
        if (parseErr || !Array.isArray(parsed))
            return logger.warn(`Ignoring unreadable ${this.file}`);

        for (const share of parsed)
            if (share?.id && share?.token) this.shares.set(share.id, share);
    }

    private get file(): string {
        return managerConfig['ingest-file'];
    }

    private async save(): Promise<void> {
        const [err] = await noTryAsync(() =>
            fs.writeFile(this.file, JSON.stringify(this.list(), null, 2)),
        );
        if (err) logger.error(`Failed to save ${this.file}: ${err.message}`);
    }
}
