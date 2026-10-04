use crate::annexb::Splitter;

const SPS: [u8; 4] = [0x67, 0x42, 0xe0, 0x1f];
const PPS: [u8; 2] = [0x68, 0xce];
const IDR: [u8; 3] = [0x65, 0x88, 0x84];
const P_FRAME: [u8; 3] = [0x41, 0x9a, 0x10];
const P_SECOND_SLICE: [u8; 3] = [0x41, 0x1a, 0x10];

fn stream(nals: &[&[u8]], long_start: bool) -> Vec<u8> {
    let start: &[u8] = if long_start {
        &[0, 0, 0, 1]
    } else {
        &[0, 0, 1]
    };
    nals.iter().flat_map(|nal| [start, nal].concat()).collect()
}

fn count_nals(data: &[u8]) -> usize {
    data.windows(4)
        .filter(|window| *window == [0, 0, 0, 1])
        .count()
}

#[test]
fn splits_on_first_macroblock_slices() {
    let bytes = stream(&[&SPS, &PPS, &IDR, &P_FRAME, &P_FRAME, &P_FRAME], true);
    let mut splitter = Splitter::default();

    let frames = splitter.push(&bytes);

    assert_eq!(frames.len(), 2);
    assert!(frames[0].keyframe);
    assert_eq!(count_nals(&frames[0].data), 3);
    assert!(!frames[1].keyframe);
}

#[test]
fn keeps_multi_slice_picture_together() {
    let bytes = stream(&[&P_FRAME, &P_SECOND_SLICE, &P_FRAME, &P_FRAME], false);
    let mut splitter = Splitter::default();

    let frames = splitter.push(&bytes);

    assert_eq!(frames.len(), 1);
    assert_eq!(count_nals(&frames[0].data), 2);
}

#[test]
fn survives_arbitrary_chunk_boundaries() {
    let bytes = stream(
        &[&SPS, &PPS, &IDR, &P_FRAME, &P_FRAME, &P_FRAME, &P_FRAME],
        true,
    );
    let mut splitter = Splitter::default();

    let frames: Vec<_> = bytes
        .chunks(1)
        .flat_map(|chunk| splitter.push(chunk))
        .collect();

    assert_eq!(frames.len(), 3);
    assert!(frames[0].keyframe);
}

#[test]
fn prepends_cached_parameter_sets_to_bare_keyframes() {
    let first = stream(&[&SPS, &PPS, &IDR, &P_FRAME], true);
    let second = stream(&[&IDR, &P_FRAME, &P_FRAME], true);
    let mut splitter = Splitter::default();

    let frames: Vec<_> = [first, second]
        .iter()
        .flat_map(|bytes| splitter.push(bytes))
        .collect();

    let keyframes: Vec<_> = frames.iter().filter(|frame| frame.keyframe).collect();
    assert_eq!(keyframes.len(), 2);
    assert_eq!(count_nals(&keyframes[1].data), 3);
}
