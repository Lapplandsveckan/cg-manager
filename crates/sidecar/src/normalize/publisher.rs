use std::{
    net::SocketAddr,
    sync::mpsc::Receiver,
    time::{Duration, Instant},
};

use str0m::{
    change::SdpOffer,
    media::{KeyframeRequestKind, MediaData, MediaKind, Mid},
    net::{Protocol, Receive, Transmit},
    Event, IceConnectionState, Input, Output, Rtc, RtcConfig,
};

use crate::ice::add_host_candidates;

use super::{
    decoder::OpenH264Decoder,
    output::spawn_ffmpeg,
    pipeline::{Format, Normalizer, Notice, Pushed},
    sink::Sink,
};

const KEYFRAME_REQUEST_INTERVAL: Duration = Duration::from_millis(500);

pub struct Pumped {
    pub transmits: Vec<Transmit>,
    pub notices: Vec<Notice>,
    pub logs: Vec<String>,
}

const DECODE_FAILURE_LOG_INTERVAL: Duration = Duration::from_secs(5);

pub struct Publisher {
    rtc: Rtc,
    pub alive: bool,
    pub timeout: Option<Instant>,
    video: Option<Mid>,
    normalizer: Normalizer,
    notices: Receiver<Notice>,
    needs_keyframe: bool,
    keyframe_requested_at: Option<Instant>,
    output_spec: Option<OutputSpec>,
    output_restarts: Vec<Instant>,
    sink: Sink,
    logs: Vec<String>,
    decode_failure_logged_at: Option<Instant>,
    received_video: bool,
    decoded: bool,
}

impl Publisher {
    pub fn open(
        sdp_offer: &str,
        candidates: &[SocketAddr],
        normalizer: Normalizer,
        notices: Receiver<Notice>,
        sink: Sink,
    ) -> Result<(Publisher, String), String> {
        let offer = SdpOffer::from_sdp_string(sdp_offer).map_err(|error| error.to_string())?;
        let mut rtc = RtcConfig::new()
            .clear_codecs()
            .enable_h264(true)
            .enable_opus(true, false)
            .build(Instant::now());

        add_host_candidates(&mut rtc, candidates)?;

        let answer = rtc
            .sdp_api()
            .accept_offer(offer)
            .map_err(|error| error.to_string())?;

        let publisher = Publisher {
            rtc,
            alive: true,
            timeout: None,
            video: None,
            normalizer,
            notices,
            needs_keyframe: false,
            keyframe_requested_at: None,
            output_spec: None,
            output_restarts: vec![],
            sink,
            logs: vec![],
            decode_failure_logged_at: None,
            received_video: false,
            decoded: false,
        };
        Ok((publisher, answer.to_sdp_string()))
    }

    pub fn receive(
        &mut self,
        now: Instant,
        source: SocketAddr,
        destination: SocketAddr,
        data: &[u8],
    ) -> bool {
        let Ok(contents) = data.try_into() else {
            return false;
        };
        let input = Input::Receive(
            now,
            Receive {
                proto: Protocol::Udp,
                source,
                destination,
                contents,
            },
        );
        if !self.rtc.accepts(&input) {
            return false;
        }

        self.handle(input);
        true
    }

    pub fn tick(&mut self, now: Instant) {
        self.handle(Input::Timeout(now));
    }

    fn handle(&mut self, input: Input) {
        if self.rtc.handle_input(input).is_err() {
            self.alive = false;
        }
    }

    pub fn pump(&mut self, now: Instant) -> Pumped {
        let notices: Vec<Notice> = self.notices.try_iter().collect();
        let failure = notices.iter().find_map(|notice| match notice {
            Notice::DecodeFailed(reason) => Some(reason.clone()),
            _ => None,
        });
        if let Some(reason) = failure {
            self.needs_keyframe = true;
            self.log_decode_failure(now, &reason);
        }

        // A decoder with no keyframe yet reports nothing at all, so asking is
        // what has to repeat until a picture comes out.
        self.decoded |= notices
            .iter()
            .any(|notice| matches!(notice, Notice::Live(_)));
        self.needs_keyframe |= !self.decoded;
        self.request_keyframe_if_needed(now);

        let mut transmits = vec![];
        self.timeout = loop {
            match self.rtc.poll_output() {
                Ok(Output::Timeout(at)) => break Some(at),
                Ok(Output::Transmit(transmit)) => transmits.push(transmit),
                Ok(Output::Event(event)) => self.on_event(event),
                Err(_) => {
                    self.alive = false;
                    break None;
                }
            }
            if !self.alive {
                break None;
            }
        };

        Pumped {
            transmits,
            notices,
            logs: std::mem::take(&mut self.logs),
        }
    }

    fn log_decode_failure(&mut self, now: Instant, reason: &str) {
        let logged_recently = self
            .decode_failure_logged_at
            .is_some_and(|at| now.duration_since(at) < DECODE_FAILURE_LOG_INTERVAL);
        if logged_recently {
            return;
        }

        self.decode_failure_logged_at = Some(now);
        self.logs.push(format!("could not decode: {reason}"));
    }

    fn request_keyframe_if_needed(&mut self, now: Instant) {
        let Some(mid) = self.video.filter(|_| self.needs_keyframe) else {
            return;
        };
        let asked_recently = self
            .keyframe_requested_at
            .is_some_and(|at| now.duration_since(at) < KEYFRAME_REQUEST_INTERVAL);
        if asked_recently {
            return;
        }

        let requested = self
            .rtc
            .writer(mid)
            .map(|mut writer| writer.request_keyframe(None, KeyframeRequestKind::Pli));
        if !matches!(requested, Some(Ok(()))) {
            return;
        }

        self.needs_keyframe = false;
        self.keyframe_requested_at = Some(now);
    }

    fn on_event(&mut self, event: Event) {
        match event {
            Event::MediaAdded(media) if media.kind == MediaKind::Video => {
                self.video = Some(media.mid);
                self.needs_keyframe = true;
                self.logs.push("sender track added".into());
            }
            Event::MediaData(data) if Some(data.mid) == self.video => self.on_video(data),
            Event::IceConnectionStateChange(state) => {
                self.logs.push(format!("ICE {state:?}"));
                self.alive &= state != IceConnectionState::Disconnected;
            }
            _ => {}
        }
    }

    // For H.264 str0m reports contiguity of RTP sequence numbers alone, so one
    // lost packet marks every following frame — a whole keyframe included —
    // until the sequence lines up again. Dropping those never recovered on a
    // network that loses anything; the decoder conceals what it can and a
    // keyframe is asked for instead.
    fn on_video(&mut self, data: MediaData) {
        self.needs_keyframe |= !data.contiguous;
        if !self.received_video {
            self.received_video = true;
            self.logs.push("receiving video".into());
        }

        match self.normalizer.push(data.data.to_vec()) {
            Pushed::Queued => {}
            Pushed::Dropped => self.needs_keyframe = true,
            Pushed::DecoderGone => self.alive = false,
        }
    }
}

#[derive(Clone, PartialEq, Eq)]
pub struct OutputSpec {
    pub format: Format,
    pub ffmpeg: String,
}

const OUTPUT_RESTART_LIMIT: usize = 5;
const OUTPUT_RESTART_WINDOW: Duration = Duration::from_secs(30);

impl Publisher {
    pub fn set_output(&mut self, spec: &OutputSpec) -> Result<(), String> {
        let running = self.normalizer.format() == Some(spec.format);
        if running && self.output_spec.as_ref() == Some(spec) {
            return Ok(());
        }

        self.start_output(spec)?;
        self.output_restarts.clear();
        Ok(())
    }

    // The peer and the readers behind a dead encoder are still good, so the
    // disposable half is respawned rather than the session being lost.
    pub fn restart_output(&mut self, now: Instant) -> Result<(), String> {
        let Some(spec) = self.output_spec.clone() else {
            return Err("no output to restart".into());
        };

        self.output_restarts
            .retain(|at| now.duration_since(*at) < OUTPUT_RESTART_WINDOW);
        if self.output_restarts.len() >= OUTPUT_RESTART_LIMIT {
            return Err("encoder keeps failing".into());
        }
        self.output_restarts.push(now);

        self.start_output(&spec)
    }

    fn start_output(&mut self, spec: &OutputSpec) -> Result<(), String> {
        if self
            .normalizer
            .format()
            .is_some_and(|running| running != spec.format)
        {
            self.sink.disconnect_readers();
        }

        let handle = spawn_ffmpeg(&spec.ffmpeg, &spec.format, self.sink.feed())
            .map_err(|error| format!("could not start {}: {error}", spec.ffmpeg))?;

        self.normalizer.set_output(spec.format, handle);
        self.output_spec = Some(spec.clone());
        Ok(())
    }

    pub fn clear_output(&mut self) {
        self.normalizer.clear_output();
        self.sink.disconnect_readers();
        self.output_spec = None;
        self.output_restarts.clear();
    }
}

pub fn start_publisher(
    sdp_offer: &str,
    candidates: &[SocketAddr],
    sink_port: u16,
) -> Result<(Publisher, String), String> {
    let sink = Sink::bind(sink_port)
        .map_err(|error| format!("could not listen on port {sink_port}: {error}"))?;
    let decoder = OpenH264Decoder::new()?;
    let (normalizer, notices) = Normalizer::start(Box::new(decoder));

    Publisher::open(sdp_offer, candidates, normalizer, notices, sink)
}
