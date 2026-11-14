export interface IngestSink {
    id: string;
    /** ffmpeg output args, including the muxer and destination. */
    args(port: number): string[];
    /** What CasparCG is told to PLAY. */
    url(port: number): string;
}

// Extension point: add a sink here to support another transport (SRT, RTP/SDP).
// Nothing else changes — `ingest.ts` looks sinks up by id and splices `args`
// onto the ffmpeg command line.
//
// `-c:v copy` is load-bearing: the browser already sends H.264, so an idle
// session costs a remux rather than a decode, which is what makes a dozen
// concurrent shares affordable. Only Opus → AAC is transcoded, because MPEG-TS
// has no sane Opus mapping.
export const SINKS: IngestSink[] = [
    {
        id: 'ts-udp',
        args: port => [
            '-c:v',
            'copy',
            '-c:a',
            'aac',
            '-b:a',
            '128k',
            '-muxdelay',
            '0',
            '-muxpreload',
            '0',
            '-flush_packets',
            '1',
            '-f',
            'mpegts',
            `udp://127.0.0.1:${port}?pkt_size=1316`,
        ],
        url: port =>
            `udp://127.0.0.1:${port}?overrun_nonfatal=1&fifo_size=1000000`,
    },
];

export const DEFAULT_SINK = 'ts-udp';

export const sinkById = (id: string) => SINKS.find(sink => sink.id === id);
