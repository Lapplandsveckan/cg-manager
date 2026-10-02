import fs from 'fs';
import os from 'os';
import path from 'path';
import { type Consumer, type Logger, type PluginAPI } from '@lappis/cg-manager';
import { noTryAsync } from 'no-try';
import { WebsocketOutboundMethod } from 'rest-exchange-protocol';
import { UUID } from '../../../util/uuid';
import { resolveSafePath, safeMediaPath } from '../../../manager/scanner/util';
import { presetById } from './presets';

export type RecordingState = 'recording' | 'done' | 'interrupted';

export interface RecordingEntry {
    id: string;
    channel: number;
    presetId: string;
    name: string;
    extension: string;
    state: RecordingState;
    startedAt: number;
    stoppedAt?: number;
    durationSec?: number;
    size?: number;
}

export interface StartRecordingOptions {
    channel: number;
    presetId: string;
    name?: string;
    durationSec?: number;
}

interface InternalRecording extends RecordingEntry {
    filePath: string;
    consumer: Consumer;
    timer?: NodeJS.Timeout;
}

const sanitizeName = (name: string | undefined, fallback: string) => {
    const trimmed = name?.trim().replace(/[/\\]+/g, '-') || '';
    return trimmed || fallback;
};

// Used when the user leaves the name blank — "channel-2-2026-10-02-143007"
// rather than a bare UUID, so an unnamed recording is still identifiable in
// the media library.
const defaultName = (channel: number) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const now = new Date();
    const stamp = [
        now.getFullYear(),
        pad(now.getMonth() + 1),
        pad(now.getDate()),
        `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`,
    ].join('-');
    return `channel-${channel}-${stamp}`;
};

export class RecordingManager {
    private readonly tempDir = path.join(os.tmpdir(), 'cg-manager-recordings');
    private readonly recordings = new Map<string, InternalRecording>();
    private readonly startingChannels = new Set<number>();

    constructor(
        private readonly api: PluginAPI,
        private readonly logger: Logger,
    ) {}

    public async init() {
        await noTryAsync(() =>
            fs.promises.rm(this.tempDir, { recursive: true, force: true }),
        );
        await fs.promises.mkdir(this.tempDir, { recursive: true });
    }

    public list(): RecordingEntry[] {
        return [...this.recordings.values()].map(toPublic);
    }

    private isChannelBusy(channel: number) {
        return (
            this.startingChannels.has(channel) ||
            [...this.recordings.values()].some(
                r => r.channel === channel && r.state === 'recording',
            )
        );
    }

    public async start(opts: StartRecordingOptions): Promise<RecordingEntry> {
        const preset = presetById(opts.presetId);
        if (!preset) throw new Error(`Unknown preset: ${opts.presetId}`);

        if (!Number.isInteger(opts.channel) || opts.channel < 1)
            throw new Error(`Invalid channel: ${opts.channel}`);

        if (
            opts.durationSec !== undefined &&
            (!Number.isFinite(opts.durationSec) ||
                opts.durationSec <= 0 ||
                opts.durationSec > 2147483) /* ~setTimeout's 32-bit ms limit */
        )
            throw new Error(`Invalid duration: ${opts.durationSec}`);

        if (this.isChannelBusy(opts.channel))
            throw new Error(`Channel ${opts.channel} is already recording`);

        this.startingChannels.add(opts.channel);
        const [recording, error] = await this.startConsumer(opts, preset);
        this.startingChannels.delete(opts.channel);
        if (error) throw error;

        this.recordings.set(recording.id, recording);
        this.broadcast();
        return toPublic(recording);
    }

    private async startConsumer(
        opts: StartRecordingOptions,
        preset: NonNullable<ReturnType<typeof presetById>>,
    ): Promise<[InternalRecording, null] | [null, Error]> {
        const channel = this.api.getChannel(opts.channel);

        const id = UUID.generate();
        const filePath = path.join(this.tempDir, `${id}.${preset.extension}`);

        const [err, consumer] = await noTryAsync(() =>
            channel.addConsumer(
                'FILE',
                filePath.replace(/\\/g, '/'),
                ...preset.args,
            ),
        );
        if (err)
            return [null, new Error(`AMCP ADD failed: ${err.message ?? err}`)];

        const recording: InternalRecording = {
            id,
            channel: opts.channel,
            presetId: opts.presetId,
            name: sanitizeName(opts.name, defaultName(opts.channel)),
            extension: preset.extension,
            state: 'recording',
            startedAt: Date.now(),
            durationSec: opts.durationSec,
            filePath,
            consumer,
        };

        if (opts.durationSec)
            recording.timer = setTimeout(
                () => void this.stop(id),
                opts.durationSec * 1000,
            );

        return [recording, null];
    }

    public async stop(id: string): Promise<RecordingEntry | null> {
        const recording = this.recordings.get(id);
        if (recording?.state !== 'recording') return null;

        // Flip state synchronously, before the REMOVE round-trip, so a
        // concurrent stop() call (duration timer racing a manual stop) sees
        // 'done' immediately and bails out above instead of sending a
        // second REMOVE.
        clearTimeout(recording.timer);
        recording.timer = undefined;
        recording.state = 'done';
        recording.stoppedAt = Date.now();

        const [err] = await noTryAsync(() => recording.consumer.remove());
        if (err)
            this.logger.warn(
                `AMCP REMOVE failed for ${recording.channel}-${recording.consumer.index}: ${err.message ?? err}`,
            );

        const [, stat] = await noTryAsync(() =>
            fs.promises.stat(recording.filePath),
        );
        recording.size = stat?.size;

        this.broadcast();
        return toPublic(recording);
    }

    /** Stops whichever recording is currently active on `channel`, if any —
     *  used by the rundown stop action, which only knows the channel. */
    public stopChannel(channel: number) {
        const active = [...this.recordings.values()].find(
            r => r.channel === channel && r.state === 'recording',
        );
        return active ? this.stop(active.id) : Promise.resolve(null);
    }

    /** `caspar-reconnect` fires both for a real CasparCG restart (every
     *  consumer is already gone) and for a bare AMCP socket bounce (the
     *  consumer is still running). We can't tell them apart, so always try
     *  REMOVE first — a 404 on a restart is harmless — before giving up and
     *  marking the recording interrupted. */
    public async handleReconnect() {
        const active = [...this.recordings.values()].filter(
            r => r.state === 'recording',
        );

        await Promise.all(
            active.map(async recording => {
                clearTimeout(recording.timer);
                recording.timer = undefined;

                await noTryAsync(() => recording.consumer.remove());

                recording.state = 'interrupted';
                recording.stoppedAt = Date.now();
                const [, stat] = await noTryAsync(() =>
                    fs.promises.stat(recording.filePath),
                );
                recording.size = stat?.size;
            }),
        );

        if (active.length) this.broadcast();
    }

    /** Best-effort stop for plugin disable — fires REMOVE without waiting
     *  for the round-trip, since the plugin is already tearing down. */
    public disposeAll() {
        for (const recording of this.recordings.values()) {
            if (recording.state !== 'recording') continue;

            clearTimeout(recording.timer);
            void noTryAsync(() => recording.consumer.remove());
        }
    }

    public async remove(id: string): Promise<boolean> {
        const recording = this.recordings.get(id);
        if (!recording || recording.state === 'recording') return false;

        await noTryAsync(() => fs.promises.unlink(recording.filePath));
        this.recordings.delete(id);
        this.broadcast();
        return true;
    }

    public async importToMedia(
        id: string,
        folder = 'recordings',
    ): Promise<{ path: string }> {
        const recording = this.recordings.get(id);
        if (!recording || recording.state === 'recording')
            throw new Error('Recording not found or still in progress');

        const mediaRoot = this.api.getMediaRoot();
        const safeFolder = sanitizeName(folder, 'recordings').replace(
            /\.\./g,
            '-',
        );
        const rawPath = `${safeFolder}/${recording.name}.${recording.extension}`;
        const relativePath = await safeMediaPath(rawPath, mediaRoot);
        const destination = resolveSafePath(mediaRoot, relativePath);

        await fs.promises.mkdir(path.dirname(destination), { recursive: true });
        await fs.promises.copyFile(recording.filePath, destination);

        return { path: relativePath };
    }

    /** Resolves to the temp file path for a finished recording, or `null`
     *  if it doesn't exist or is still being written. */
    public getDownloadPath(id: string): string | null {
        const recording = this.recordings.get(id);
        if (!recording || recording.state === 'recording') return null;
        return recording.filePath;
    }

    private broadcast() {
        this.api.broadcast(
            'recordings',
            WebsocketOutboundMethod.UPDATE,
            this.list(),
        );
    }
}

const toPublic = (recording: InternalRecording): RecordingEntry => {
    const {
        filePath: _filePath,
        consumer: _consumer,
        timer: _timer,
        ...rest
    } = recording;
    return rest;
};
