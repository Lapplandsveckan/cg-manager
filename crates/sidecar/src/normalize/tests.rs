use std::{sync::Arc, time::Duration};

use super::{
    frame::{black_frame, letterbox_rect, Letterbox, Picture, Plane, Rect, Size},
    pipeline::{missed_frames, next_tick, size_notice, tick_time, ticks_elapsed, Fps, Notice},
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
fn a_skipped_tick_is_made_up_with_the_frame_it_would_have_shown() {
    let held = Arc::new(vec![7u8; 4]);

    assert_eq!(missed_frames(&Some(held.clone()), 3, 30).len(), 3);
    assert_eq!(missed_frames(&Some(held.clone()), 0, 30).len(), 0);
    assert_eq!(missed_frames(&None, 3, 30).len(), 0);
}

#[test]
fn catching_up_stops_short_of_a_stalled_encoder() {
    let held = Arc::new(vec![7u8; 4]);

    assert_eq!(missed_frames(&Some(held), 500, 30).len(), 30);
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
