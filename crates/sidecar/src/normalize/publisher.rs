use std::{
    net::SocketAddr,
    sync::mpsc::Receiver,
    time::{Duration, Instant},
};

use str0m::{
    change::SdpOffer,
    media::{KeyframeRequestKind, MediaData, MediaKind, Mid},
    net::{Protocol, Receive},
    Candidate, Event, IceConnectionState, Input, Output, Rtc, RtcConfig,
};

use super::{
    decoder::OpenH264Decoder,
    output::spawn_ffmpeg,
    pipeline::{Format, Normalizer, Notice, Pushed},
};

const KEYFRAME_REQUEST_INTERVAL: Duration = Duration::from_millis(500);

pub struct Pumped {
    pub transmits: Vec<(SocketAddr, Vec<u8>)>,
    pub notices: Vec<Notice>,
}

pub struct Publisher {
    rtc: Rtc,
    pub alive: bool,
    pub timeout: Option<Instant>,
    video: Option<Mid>,
    normalizer: Normalizer,
    notices: Receiver<Notice>,
    needs_keyframe: bool,
    keyframe_requested_at: Option<Instant>,
}

impl Publisher {
    pub fn open(
        sdp_offer: &str,
        candidate: SocketAddr,
        normalizer: Normalizer,
        notices: Receiver<Notice>,
    ) -> Result<(Publisher, String), String> {
        let offer = SdpOffer::from_sdp_string(sdp_offer).map_err(|error| error.to_string())?;
        let mut rtc = RtcConfig::new()
            .clear_codecs()
            .enable_h264(true)
            .enable_opus(true, false)
            .build(Instant::now());

        let host = Candidate::host(candidate, "udp").map_err(|error| error.to_string())?;
        rtc.add_local_candidate(host);

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
        let decode_failed = notices
            .iter()
            .any(|notice| matches!(notice, Notice::DecodeFailed(_)));
        self.needs_keyframe |= decode_failed;
        self.request_keyframe_if_needed(now);

        let mut transmits = vec![];
        self.timeout = loop {
            match self.rtc.poll_output() {
                Ok(Output::Timeout(at)) => break Some(at),
                Ok(Output::Transmit(transmit)) => {
                    transmits.push((transmit.destination, transmit.contents.to_vec()));
                }
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

        Pumped { transmits, notices }
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
            }
            Event::MediaData(data) if Some(data.mid) == self.video => self.on_video(data),
            Event::IceConnectionStateChange(IceConnectionState::Disconnected) => self.alive = false,
            _ => {}
        }
    }

    fn on_video(&mut self, data: MediaData) {
        if !data.contiguous {
            self.needs_keyframe = true;
            return;
        }

        match self.normalizer.push(data.data.to_vec()) {
            Pushed::Queued => {}
            Pushed::Dropped => self.needs_keyframe = true,
            Pushed::DecoderGone => self.alive = false,
        }
    }
}

pub struct OutputSpec {
    pub format: Format,
    pub ffmpeg: String,
    pub output_args: Vec<String>,
}

impl Publisher {
    pub fn set_output(&mut self, spec: &OutputSpec) -> Result<(), String> {
        if self.normalizer.format() == Some(spec.format) {
            return Ok(());
        }

        let handle = spawn_ffmpeg(&spec.ffmpeg, &spec.format, &spec.output_args)
            .map_err(|error| format!("could not start {}: {error}", spec.ffmpeg))?;
        self.normalizer.set_output(spec.format, handle);
        Ok(())
    }

    pub fn clear_output(&mut self) {
        self.normalizer.clear_output();
    }
}

pub fn start_publisher(
    sdp_offer: &str,
    candidate: SocketAddr,
) -> Result<(Publisher, String), String> {
    let decoder = OpenH264Decoder::new()?;
    let (normalizer, notices) = Normalizer::start(Box::new(decoder));

    Publisher::open(sdp_offer, candidate, normalizer, notices)
}
