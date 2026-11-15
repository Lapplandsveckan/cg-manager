use super::pipeline::Format;

const TICKS_PER_SECOND: u64 = 1_000_000;
const NANOS_PER_SECOND: u64 = 1_000_000_000;
const APP: &str = "cg-sidecar";
const VIDEO_TRACK: u64 = 1;

const EBML: &[u8] = &[0x1A, 0x45, 0xDF, 0xA3];
const EBML_VERSION: &[u8] = &[0x42, 0x86];
const EBML_READ_VERSION: &[u8] = &[0x42, 0xF7];
const EBML_MAX_ID_LENGTH: &[u8] = &[0x42, 0xF2];
const EBML_MAX_SIZE_LENGTH: &[u8] = &[0x42, 0xF3];
const DOC_TYPE: &[u8] = &[0x42, 0x82];
const DOC_TYPE_VERSION: &[u8] = &[0x42, 0x87];
const DOC_TYPE_READ_VERSION: &[u8] = &[0x42, 0x85];
const SEGMENT_OF_UNKNOWN_SIZE: &[u8] = &[
    0x18, 0x53, 0x80, 0x67, 0x01, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
];
const INFO: &[u8] = &[0x15, 0x49, 0xA9, 0x66];
const TIMESTAMP_SCALE: &[u8] = &[0x2A, 0xD7, 0xB1];
const MUXING_APP: &[u8] = &[0x4D, 0x80];
const WRITING_APP: &[u8] = &[0x57, 0x41];
const TRACKS: &[u8] = &[0x16, 0x54, 0xAE, 0x6B];
const TRACK_ENTRY: &[u8] = &[0xAE];
const TRACK_NUMBER: &[u8] = &[0xD7];
const TRACK_UID: &[u8] = &[0x73, 0xC5];
const TRACK_TYPE: &[u8] = &[0x83];
const FLAG_LACING: &[u8] = &[0x9C];
const DEFAULT_DURATION: &[u8] = &[0x23, 0xE3, 0x83];
const CODEC_ID: &[u8] = &[0x86];
const VIDEO: &[u8] = &[0xE0];
const PIXEL_WIDTH: &[u8] = &[0xB0];
const PIXEL_HEIGHT: &[u8] = &[0xBA];
const CLUSTER: &[u8] = &[0x1F, 0x43, 0xB6, 0x75];
const TIMESTAMP: &[u8] = &[0xE7];
const SIMPLE_BLOCK: &[u8] = &[0xA3];

const VIDEO_TRACK_TYPE: u64 = 1;
const KEYFRAME: u8 = 0x80;
// Track number as a one-byte vint, a zero offset from the cluster, then flags.
const BLOCK_HEADER: [u8; 4] = [0x80 | VIDEO_TRACK as u8, 0, 0, KEYFRAME];

fn element_header(id: &[u8], body_bytes: usize) -> Vec<u8> {
    let eight_byte_size = body_bytes as u64 | 1 << 56;
    [id, &eight_byte_size.to_be_bytes()].concat()
}

fn element(id: &[u8], body: &[u8]) -> Vec<u8> {
    [&element_header(id, body.len()), body].concat()
}

fn uint(id: &[u8], value: u64) -> Vec<u8> {
    element(id, &value.to_be_bytes())
}

fn text(id: &[u8], value: &str) -> Vec<u8> {
    element(id, value.as_bytes())
}

fn frame_nanos(format: &Format) -> u64 {
    NANOS_PER_SECOND * format.fps.denominator as u64 / format.fps.numerator as u64
}

pub fn timestamp(format: &Format, index: u64) -> u64 {
    let ticks = index as u128 * format.fps.denominator as u128 * TICKS_PER_SECOND as u128
        / format.fps.numerator as u128;
    ticks as u64
}

// DefaultDuration lets a demuxer take the frame rate from the header instead of measuring it.
pub fn header(format: &Format) -> Vec<u8> {
    let ebml = element(
        EBML,
        &[
            uint(EBML_VERSION, 1),
            uint(EBML_READ_VERSION, 1),
            uint(EBML_MAX_ID_LENGTH, 4),
            uint(EBML_MAX_SIZE_LENGTH, 8),
            text(DOC_TYPE, "matroska"),
            uint(DOC_TYPE_VERSION, 2),
            uint(DOC_TYPE_READ_VERSION, 2),
        ]
        .concat(),
    );
    let info = element(
        INFO,
        &[
            uint(TIMESTAMP_SCALE, NANOS_PER_SECOND / TICKS_PER_SECOND),
            text(MUXING_APP, APP),
            text(WRITING_APP, APP),
        ]
        .concat(),
    );
    let video = element(
        VIDEO,
        &[
            uint(PIXEL_WIDTH, format.size.width as u64),
            uint(PIXEL_HEIGHT, format.size.height as u64),
        ]
        .concat(),
    );
    let track = element(
        TRACK_ENTRY,
        &[
            uint(TRACK_NUMBER, VIDEO_TRACK),
            uint(TRACK_UID, VIDEO_TRACK),
            uint(TRACK_TYPE, VIDEO_TRACK_TYPE),
            uint(FLAG_LACING, 0),
            uint(DEFAULT_DURATION, frame_nanos(format)),
            text(CODEC_ID, "V_MPEG2"),
            video,
        ]
        .concat(),
    );

    [
        &ebml,
        SEGMENT_OF_UNKNOWN_SIZE,
        &info,
        &element(TRACKS, &track),
    ]
    .concat()
}

pub fn cluster_prefix(format: &Format, index: u64, frame_bytes: usize) -> Vec<u8> {
    let time = uint(TIMESTAMP, timestamp(format, index));
    let block = element_header(SIMPLE_BLOCK, BLOCK_HEADER.len() + frame_bytes);
    let body_bytes = time.len() + block.len() + BLOCK_HEADER.len() + frame_bytes;

    [
        &element_header(CLUSTER, body_bytes),
        &time,
        &block,
        &BLOCK_HEADER[..],
    ]
    .concat()
}
