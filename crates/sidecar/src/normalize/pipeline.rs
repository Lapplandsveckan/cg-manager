use std::{
    io,
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc::{self, Receiver, RecvTimeoutError, Sender, SyncSender, TrySendError},
        Arc, Mutex, MutexGuard, PoisonError,
    },
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};

use super::{
    decoder::Decoder,
    frame::{black_frame, Letterbox, PackedPicture, Size},
    output::OutputHandle,
};

const NANOS_PER_SECOND: u128 = 1_000_000_000;
const PENDING_ACCESS_UNITS: usize = 4;
const PENDING_OUTPUT_FRAMES: usize = 1;
const RETARGET_POLL: Duration = Duration::from_millis(50);
// Past this an encoder is not merely late, and making up every missed frame
// would only put it further behind.
const MAX_CATCH_UP: Duration = Duration::from_secs(1);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Fps {
    pub numerator: u32,
    pub denominator: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Format {
    pub size: Size,
    pub fps: Fps,
}

const MAX_FPS: u32 = 1000;

impl Format {
    pub fn is_playable(&self) -> bool {
        let has_area = self.size.width >= 2 && self.size.height >= 2;
        let has_rate = self.fps.numerator > 0 && self.fps.denominator > 0;
        let sane_rate = has_rate && self.fps.numerator / self.fps.denominator <= MAX_FPS;

        has_area && sane_rate
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum Pushed {
    Queued,
    Dropped,
    DecoderGone,
}

#[derive(Debug, PartialEq, Eq)]
pub enum Notice {
    Live(Size),
    InputChanged(Size),
    DecodeFailed(String),
    OutputFailed(String),
}

struct Slot {
    target: Option<Size>,
    frame: Arc<Vec<u8>>,
}

type SharedSlot = Arc<Mutex<Slot>>;

fn lock(slot: &SharedSlot) -> MutexGuard<'_, Slot> {
    slot.lock().unwrap_or_else(PoisonError::into_inner)
}

pub fn tick_time(tick: u64, fps: Fps) -> Duration {
    let nanos = tick as u128 * fps.denominator as u128 * NANOS_PER_SECOND / fps.numerator as u128;
    Duration::from_nanos(nanos as u64)
}

pub fn ticks_elapsed(elapsed: Duration, fps: Fps) -> u64 {
    let ticks =
        elapsed.as_nanos() * fps.numerator as u128 / (fps.denominator as u128 * NANOS_PER_SECOND);
    ticks as u64
}

// A late ticker skips to the present instead of bursting the ticks it missed.
pub fn next_tick(tick: u64, elapsed: Duration, fps: Fps) -> u64 {
    (tick + 1).max(ticks_elapsed(elapsed, fps))
}

pub fn size_notice(previous: Option<Size>, size: Size) -> Option<Notice> {
    match previous {
        None => Some(Notice::Live(size)),
        Some(known) if known != size => Some(Notice::InputChanged(size)),
        Some(_) => None,
    }
}

fn decode_unit(
    decoder: &mut dyn Decoder,
    access_unit: &[u8],
    notices: &Sender<Notice>,
) -> Option<PackedPicture> {
    let mut decoded = None;
    let result = decoder.decode(access_unit, &mut |picture| decoded = picture.pack());
    if let Err(message) = result {
        let _ = notices.send(Notice::DecodeFailed(message));
    }
    decoded
}

fn store_if_current(slot: &SharedSlot, size: Size, frame: Vec<u8>) {
    let mut slot = lock(slot);
    if slot.target == Some(size) {
        slot.frame = Arc::new(frame);
    }
}

fn decode_loop(
    access_units: Receiver<Vec<u8>>,
    mut decoder: Box<dyn Decoder>,
    slot: SharedSlot,
    notices: Sender<Notice>,
) {
    let mut source: Option<PackedPicture> = None;
    let mut letterbox: Option<Letterbox> = None;

    loop {
        let received = access_units.recv_timeout(RETARGET_POLL);
        if matches!(received, Err(RecvTimeoutError::Disconnected)) {
            return;
        }
        let fresh = received
            .ok()
            .and_then(|unit| decode_unit(decoder.as_mut(), &unit, &notices));

        let target = lock(&slot).target;
        let retargeted = letterbox.as_ref().map(Letterbox::target) != target;
        if retargeted {
            letterbox = target.map(Letterbox::new);
        }

        if let Some(picture) = fresh {
            let previous = source.as_ref().map(|known| known.size);
            if let Some(notice) = size_notice(previous, picture.size) {
                let _ = notices.send(notice);
            }
            source = Some(picture);
        } else if !retargeted {
            continue;
        }

        let (Some(letterbox), Some(source)) = (letterbox.as_mut(), source.as_ref()) else {
            continue;
        };
        if let Some(frame) = letterbox.fit(source) {
            store_if_current(&slot, letterbox.target(), frame);
        }
    }
}

fn tick_loop(
    fps: Fps,
    slot: SharedSlot,
    frames: SyncSender<(u64, Arc<Vec<u8>>)>,
    stop: Arc<AtomicBool>,
) {
    let start = Instant::now();
    let mut tick = 0;

    while !stop.load(Ordering::Relaxed) {
        thread::sleep(tick_time(tick, fps).saturating_sub(start.elapsed()));

        let frame = lock(&slot).frame.clone();
        if let Err(TrySendError::Disconnected(_)) = frames.try_send((tick, frame)) {
            return;
        }
        tick = next_tick(tick, start.elapsed(), fps);
    }
}

// The encoder reads frame count as time, so a tick that never reached it has to
// be made up or the stream falls permanently behind the clock it was paced on.
pub fn missed_frames(
    previous: &Option<Arc<Vec<u8>>>,
    missed: u64,
    limit: u64,
) -> Vec<Arc<Vec<u8>>> {
    let Some(frame) = previous else {
        return vec![];
    };

    vec![frame.clone(); missed.min(limit) as usize]
}

fn write_frames(output: &mut dyn super::output::Output, frames: &[Arc<Vec<u8>>]) -> io::Result<()> {
    frames.iter().try_for_each(|frame| output.write(frame))
}

fn write_loop(
    frames: Receiver<(u64, Arc<Vec<u8>>)>,
    fps: Fps,
    mut output: Box<dyn super::output::Output>,
    notices: Sender<Notice>,
    stop: Arc<AtomicBool>,
) {
    let limit = ticks_elapsed(MAX_CATCH_UP, fps);
    let mut written = 0;
    let mut previous: Option<Arc<Vec<u8>>> = None;

    for (tick, frame) in frames {
        let mut batch = missed_frames(&previous, tick.saturating_sub(written), limit);
        batch.push(frame.clone());
        written = tick + 1;
        previous = Some(frame);

        let Err(error) = write_frames(output.as_mut(), &batch) else {
            continue;
        };
        if !stop.load(Ordering::Relaxed) {
            let _ = notices.send(Notice::OutputFailed(error.to_string()));
        }
        return;
    }
}

struct OutputStage {
    stop: Arc<AtomicBool>,
    tick: Option<JoinHandle<()>>,
    write: Option<JoinHandle<()>>,
    kill: Option<Box<dyn FnOnce() + Send>>,
}

impl Drop for OutputStage {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
        if let Some(tick) = self.tick.take() {
            let _ = tick.join();
        }
        // A write blocked on a stalled encoder only returns once it is killed.
        if let Some(kill) = self.kill.take() {
            kill();
        }
        if let Some(write) = self.write.take() {
            let _ = write.join();
        }
    }
}

pub struct Normalizer {
    access_units: Option<SyncSender<Vec<u8>>>,
    slot: SharedSlot,
    notices: Sender<Notice>,
    decode: Option<JoinHandle<()>>,
    stage: Option<OutputStage>,
    format: Option<Format>,
}

impl Normalizer {
    pub fn start(decoder: Box<dyn Decoder>) -> (Normalizer, Receiver<Notice>) {
        let slot: SharedSlot = Arc::new(Mutex::new(Slot {
            target: None,
            frame: Arc::new(vec![]),
        }));
        let (notices, notice_receiver) = mpsc::channel();
        let (access_units, access_unit_receiver) = mpsc::sync_channel(PENDING_ACCESS_UNITS);

        let decode = {
            let (slot, notices) = (slot.clone(), notices.clone());
            thread::spawn(move || decode_loop(access_unit_receiver, decoder, slot, notices))
        };

        let normalizer = Normalizer {
            access_units: Some(access_units),
            slot,
            notices,
            decode: Some(decode),
            stage: None,
            format: None,
        };
        (normalizer, notice_receiver)
    }

    pub fn push(&self, access_unit: Vec<u8>) -> Pushed {
        let Some(sender) = self.access_units.as_ref() else {
            return Pushed::DecoderGone;
        };

        match sender.try_send(access_unit) {
            Ok(()) => Pushed::Queued,
            Err(TrySendError::Full(_)) => Pushed::Dropped,
            Err(TrySendError::Disconnected(_)) => Pushed::DecoderGone,
        }
    }

    pub fn format(&self) -> Option<Format> {
        self.format
    }

    pub fn set_output(&mut self, format: Format, handle: OutputHandle) {
        let previous = lock(&self.slot).target;
        self.clear_output();
        {
            let mut slot = lock(&self.slot);
            slot.target = Some(format.size);
            // Restarting at the same size keeps showing the live picture
            // instead of blacking out until the sender's next frame.
            if previous != Some(format.size) {
                slot.frame = Arc::new(black_frame(format.size));
            }
        }

        let stop = Arc::new(AtomicBool::new(false));
        let (frames, frame_receiver) = mpsc::sync_channel(PENDING_OUTPUT_FRAMES);
        let tick = {
            let (slot, stop) = (self.slot.clone(), stop.clone());
            thread::spawn(move || tick_loop(format.fps, slot, frames, stop))
        };
        let write = {
            let (notices, stop) = (self.notices.clone(), stop.clone());
            thread::spawn(move || {
                write_loop(frame_receiver, format.fps, handle.output, notices, stop)
            })
        };

        self.format = Some(format);
        self.stage = Some(OutputStage {
            stop,
            tick: Some(tick),
            write: Some(write),
            kill: Some(handle.kill),
        });
    }

    pub fn clear_output(&mut self) {
        self.stage = None;
        self.format = None;
        lock(&self.slot).target = None;
    }
}

impl Drop for Normalizer {
    fn drop(&mut self) {
        self.clear_output();
        self.access_units.take();
        if let Some(decode) = self.decode.take() {
            let _ = decode.join();
        }
    }
}
