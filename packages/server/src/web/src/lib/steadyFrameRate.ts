const FRAMES_PER_SECOND = 30;

// Runs in a worker because a hidden tab's timers are clamped to one per
// second, and the sharing tab is hidden for most of a share.
const repeaterSource = `
    const microseconds = () => Math.round(performance.now() * 1000);

    onmessage = async ({ data: { readable, writable, interval } }) => {
        const reader = readable.getReader();
        const writer = writable.getWriter();
        let latest = null;
        let writtenAt = 0;

        const write = () => {
            writtenAt = performance.now();
            const frame = new VideoFrame(latest, { timestamp: microseconds() });

            return writer.write(frame).catch(() => frame.close());
        };

        const repeat = () => {
            if (!latest) return;
            if (performance.now() - writtenAt < interval * 0.75) return;

            write();
        };
        const timer = setInterval(repeat, interval);

        for (;;) {
            const { done, value } = await reader
                .read()
                .catch(() => ({ done: true }));
            if (done) break;

            latest?.close();
            latest = value;
            write();
        }

        clearInterval(timer);
        latest?.close();
    };
`;

interface TrackProcessor {
    readable: ReadableStream;
}

interface TrackGenerator extends MediaStreamTrack {
    writable: WritableStream;
}

interface InsertableStreams {
    MediaStreamTrackProcessor?: new (init: {
        track: MediaStreamTrack;
    }) => TrackProcessor;
    MediaStreamTrackGenerator?: new (init: { kind: 'video' }) => TrackGenerator;
}

export interface SteadyTrack {
    track: MediaStreamTrack;
    stop(): void;
}

// CasparCG turns every gap between frames into permanent playout delay.
export function steadyFrameRate(source: MediaStreamTrack): SteadyTrack {
    const { MediaStreamTrackProcessor, MediaStreamTrackGenerator } =
        window as unknown as InsertableStreams;
    if (!MediaStreamTrackProcessor || !MediaStreamTrackGenerator)
        return { track: source, stop: () => undefined };

    const { readable } = new MediaStreamTrackProcessor({ track: source });
    const generator = new MediaStreamTrackGenerator({ kind: 'video' });

    const sourceUrl = URL.createObjectURL(
        new Blob([repeaterSource], { type: 'text/javascript' }),
    );
    const worker = new Worker(sourceUrl);
    URL.revokeObjectURL(sourceUrl);

    const { writable } = generator;
    const interval = 1000 / FRAMES_PER_SECOND;
    worker.postMessage({ readable, writable, interval }, [readable, writable]);

    return {
        track: generator,
        stop: () => {
            worker.terminate();
            generator.stop();
        },
    };
}
