const NAL_SLICE: u8 = 1;
const NAL_IDR: u8 = 5;
const NAL_SEI: u8 = 6;
const NAL_SPS: u8 = 7;
const NAL_PPS: u8 = 8;
const NAL_AUD: u8 = 9;
const START_CODE: [u8; 4] = [0, 0, 0, 1];

pub struct Frame {
    pub data: Vec<u8>,
    pub keyframe: bool,
}

#[derive(Default)]
struct AccessUnit {
    nals: Vec<Vec<u8>>,
    has_slice: bool,
    keyframe: bool,
}

#[derive(Default)]
pub struct Splitter {
    buf: Vec<u8>,
    unit: AccessUnit,
    sps: Option<Vec<u8>>,
    pps: Option<Vec<u8>>,
}

fn nal_type(nal: &[u8]) -> u8 {
    nal[0] & 0x1f
}

fn starts_at_first_macroblock(nal: &[u8]) -> bool {
    nal.get(1).is_some_and(|byte| byte & 0x80 != 0)
}

fn start_code_offsets(buf: &[u8]) -> Vec<usize> {
    buf.windows(3)
        .enumerate()
        .filter(|(_, window)| *window == [0, 0, 1])
        .map(|(offset, _)| offset)
        .collect()
}

fn trim_trailing_zeros(nal: &[u8]) -> &[u8] {
    let end = nal
        .iter()
        .rposition(|byte| *byte != 0)
        .map_or(0, |last| last + 1);
    &nal[..end]
}

fn serialize(nals: &[&[u8]]) -> Vec<u8> {
    nals.iter()
        .flat_map(|nal| START_CODE.iter().chain(nal.iter()))
        .copied()
        .collect()
}

impl Splitter {
    pub fn push(&mut self, bytes: &[u8]) -> Vec<Frame> {
        self.buf.extend_from_slice(bytes);

        let offsets = start_code_offsets(&self.buf);
        let Some(&last) = offsets.last() else {
            let keep_from = self.buf.len().saturating_sub(2);
            self.buf.drain(..keep_from);
            return vec![];
        };

        let complete: Vec<Vec<u8>> = offsets
            .windows(2)
            .map(|pair| trim_trailing_zeros(&self.buf[pair[0] + 3..pair[1]]).to_vec())
            .filter(|nal| !nal.is_empty())
            .collect();
        self.buf.drain(..last);

        complete
            .into_iter()
            .filter_map(|nal| self.accept(nal))
            .collect()
    }

    fn accept(&mut self, nal: Vec<u8>) -> Option<Frame> {
        let kind = nal_type(&nal);
        if kind == NAL_SPS {
            self.sps = Some(nal.clone());
        }
        if kind == NAL_PPS {
            self.pps = Some(nal.clone());
        }

        let finished = self
            .starts_new_unit(kind, &nal)
            .then(|| self.finish())
            .flatten();

        if kind == NAL_AUD {
            return finished;
        }
        self.unit.has_slice |= kind == NAL_SLICE || kind == NAL_IDR;
        self.unit.keyframe |= kind == NAL_IDR;
        self.unit.nals.push(nal);
        finished
    }

    fn starts_new_unit(&self, kind: u8, nal: &[u8]) -> bool {
        match kind {
            NAL_AUD | NAL_SEI | NAL_SPS | NAL_PPS => self.unit.has_slice,
            NAL_SLICE | NAL_IDR => self.unit.has_slice && starts_at_first_macroblock(nal),
            _ => false,
        }
    }

    fn finish(&mut self) -> Option<Frame> {
        let unit = std::mem::take(&mut self.unit);
        if !unit.has_slice {
            self.unit = unit;
            return None;
        }

        let has_parameter_sets = unit.nals.iter().any(|nal| nal_type(nal) == NAL_SPS);
        let cached: Vec<&[u8]> = match (&self.sps, &self.pps) {
            (Some(sps), Some(pps)) if unit.keyframe && !has_parameter_sets => vec![sps, pps],
            _ => vec![],
        };
        let body: Vec<&[u8]> = unit.nals.iter().map(Vec::as_slice).collect();

        Some(Frame {
            data: serialize(&[cached, body].concat()),
            keyframe: unit.keyframe,
        })
    }
}
