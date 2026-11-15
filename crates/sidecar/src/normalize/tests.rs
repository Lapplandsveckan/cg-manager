use std::{io::Read, time::Duration};

use super::{
    avi,
    frame::{black_frame, letterbox_rect, Letterbox, Picture, Plane, Rect, Size},
    mkv,
    pipeline::{next_tick, size_notice, tick_time, ticks_elapsed, Format, Fps, Notice},
    sink::{reader_sequence, DRAIN_INTERVAL, OPENING_FRAMES},
};

const HD: Size = Size {
    width: 1280,
    height: 720,
};
const THIRTY: Fps = Fps {
    numerator: 30,
    denominator: 1,
};

fn size(width: usize, height: usize) -> Size {
    Size { width, height }
}

#[test]
fn letterboxes_a_tall_source_with_side_bars() {
    let rect = letterbox_rect(size(720, 1280), HD);
    assert_eq!(
        rect,
        Rect {
            left: 438,
            top: 0,
            size: size(404, 720)
        }
    );
}

#[test]
fn letterboxes_a_wide_source_with_top_and_bottom_bars() {
    let rect = letterbox_rect(size(2560, 1080), HD);
    assert_eq!(
        rect,
        Rect {
            left: 0,
            top: 90,
            size: size(1280, 540)
        }
    );
}

#[test]
fn fills_the_frame_when_aspect_matches() {
    let rect = letterbox_rect(size(1920, 1080), HD);
    assert_eq!(
        rect,
        Rect {
            left: 0,
            top: 0,
            size: HD
        }
    );
}

#[test]
fn fitted_frame_always_has_the_target_size() {
    let source = size(641, 479);
    let packed = size(640, 478);
    let stride = 672;
    let luma = vec![200u8; stride * source.height];
    let chroma = vec![90u8; packed.height * (stride / 2) / 2];
    let picture = Picture {
        size: source,
        y: Plane {
            data: &luma,
            stride,
        },
        u: Plane {
            data: &chroma,
            stride: stride / 2,
        },
        v: Plane {
            data: &chroma,
            stride: stride / 2,
        },
    };

    let frame = Letterbox::new(HD).fit(&picture.pack().unwrap()).unwrap();

    assert_eq!(frame.len(), HD.frame_bytes());
    assert_eq!(frame[0], 16);
    assert_eq!(frame[HD.width * 360 + 640], 200);
}

#[test]
fn black_frame_is_video_black() {
    let frame = black_frame(size(4, 2));
    assert_eq!(frame, [16, 16, 16, 16, 16, 16, 16, 16, 128, 128, 128, 128]);
}

#[test]
fn ticks_are_evenly_spaced() {
    assert_eq!(tick_time(30, THIRTY), Duration::from_secs(1));
    assert_eq!(ticks_elapsed(Duration::from_millis(1001), THIRTY), 30);
}

#[test]
fn an_on_time_ticker_advances_by_one() {
    assert_eq!(next_tick(4, Duration::from_millis(134), THIRTY), 5);
}

#[test]
fn a_late_ticker_skips_to_the_present() {
    assert_eq!(next_tick(4, Duration::from_secs(2), THIRTY), 60);
}

#[test]
fn reports_first_frame_then_only_size_changes() {
    assert_eq!(size_notice(None, HD), Some(Notice::Live(HD)));
    assert_eq!(size_notice(Some(HD), HD), None);
    assert_eq!(
        size_notice(Some(HD), size(640, 480)),
        Some(Notice::InputChanged(size(640, 480)))
    );
}

fn chunk(id: &[u8; 4], data: &[u8]) -> Vec<u8> {
    let padding = vec![0u8; data.len() & 1];
    [id, &(data.len() as u32).to_le_bytes()[..], data, &padding].concat()
}

fn frames_in(stream: &[u8]) -> Vec<Vec<u8>> {
    let mut frames = vec![];
    let _ = avi::read_frames(stream, |frame| frames.push(frame));
    frames
}

#[test]
fn reads_video_frames_out_of_a_piped_avi() {
    let stream = [
        b"RIFF\xff\xff\xff\xffAVI ".to_vec(),
        b"LIST\x10\x00\x00\x00hdrl".to_vec(),
        chunk(b"avih", &[1, 2, 3, 4]),
        b"LIST\x00\x00\x00\x00movi".to_vec(),
        chunk(b"00dc", &[9, 8, 7]),
        chunk(b"JUNK", &[0; 5]),
        chunk(b"00dc", &[6, 5]),
    ]
    .concat();

    assert_eq!(frames_in(&stream), [vec![9, 8, 7], vec![6, 5]]);
}

#[test]
fn a_frame_cut_short_is_not_reported() {
    let whole = chunk(b"00dc", &[9, 8, 7, 6]);

    assert!(frames_in(&whole[..whole.len() - 1]).is_empty());
}

const HD_NTSC: Format = Format {
    size: HD,
    fps: Fps {
        numerator: 60000,
        denominator: 1001,
    },
};

#[test]
fn timestamps_follow_the_frame_rate_without_drifting() {
    assert_eq!(mkv::timestamp(&HD_NTSC, 0), 0);
    assert_eq!(mkv::timestamp(&HD_NTSC, 60000), 1001 * 1_000_000);
}

#[test]
fn a_cluster_declares_exactly_the_bytes_that_follow_it() {
    let frame_bytes = 1000;
    let prefix = mkv::cluster_prefix(&HD_NTSC, 7, frame_bytes);
    let cluster_header_bytes = 4 + 8;

    let mut declared = [0u8; 8];
    (&prefix[4..]).read_exact(&mut declared).unwrap();
    let declared = u64::from_be_bytes(declared) & !(1 << 56);

    assert_eq!(
        declared as usize,
        prefix.len() - cluster_header_bytes + frame_bytes
    );
}

#[test]
fn a_reader_opens_on_the_current_picture_repeated() {
    let sent: Vec<usize> = reader_sequence(Some(99), 0..2).collect();

    assert_eq!(sent, [vec![99; OPENING_FRAMES], vec![0, 1]].concat());
}

#[test]
fn a_reader_with_no_picture_yet_opens_on_the_first_live_one() {
    let sent: Vec<usize> = reader_sequence(None, 7..9).collect();

    assert_eq!(sent, [vec![7; OPENING_FRAMES], vec![8]].concat());
}

#[test]
fn one_live_frame_in_every_interval_is_held_back() {
    let live = 0..DRAIN_INTERVAL * 3;
    let sent: Vec<usize> = reader_sequence(Some(0), live).collect();

    assert_eq!(sent.len(), OPENING_FRAMES + DRAIN_INTERVAL * 3 - 3);
    assert!(!sent.contains(&(DRAIN_INTERVAL - 1)));
}
