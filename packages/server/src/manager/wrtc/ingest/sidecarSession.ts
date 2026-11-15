import { noTryAsync } from 'no-try';
import { ffmpegBinary } from '../../../util/ffmpeg';
import { sidecar, type SidecarEvent } from '../shared/sidecar';
import { type OutputFormat } from './channelFormat';
import { type IngestSink } from './sinks';

export interface SidecarSessionHooks {
    onLive(): void;
    onClosed(): void;
}

export interface SessionOutput {
    set(format: OutputFormat): Promise<void>;
    clear(): void;
}

export interface SidecarSession {
    sdpAnswer: string;
    output: SessionOutput;
    teardown(): Promise<void>;
}

export async function openSidecarSession(
    sdpOffer: string,
    sink: IngestSink,
    sinkPort: number,
    hooks: SidecarSessionHooks,
): Promise<SidecarSession> {
    const publishId = sidecar.allocateId();

    const onEvent = (event: SidecarEvent) => {
        if (event.id !== publishId) return;
        if (event.type === 'publish_live') return hooks.onLive();
        if (event.type === 'publish_closed') hooks.onClosed();
    };

    const stopListening = () => {
        sidecar.off('event', onEvent);
        sidecar.off('exit', hooks.onClosed);
    };

    const unpublish = () =>
        sidecar.sendIfRunning({ type: 'unpublish', id: publishId });

    // Subscribed before the request so no event for this id can be missed.
    sidecar.on('event', onEvent);
    const [error, published] = await noTryAsync(() =>
        sidecar.request({ type: 'publish', sdpOffer }, publishId),
    );
    if (error) {
        stopListening();
        unpublish();
        throw error;
    }
    sidecar.once('exit', hooks.onClosed);

    // Unqueued: the sidecar applies commands in write order, so a later clear wins.
    const output: SessionOutput = {
        set: async format => {
            await sidecar.request({
                type: 'set_output',
                publishId,
                ...format,
                ffmpeg: ffmpegBinary(),
                outputArgs: sink.args(sinkPort),
            });
        },
        clear: () =>
            sidecar.sendIfRunning({ type: 'clear_output', id: publishId }),
    };

    const teardown = async () => {
        stopListening();
        unpublish();
    };

    return { sdpAnswer: String(published.sdpAnswer), output, teardown };
}
