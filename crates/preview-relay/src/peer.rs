use std::{net::SocketAddr, time::Instant};

use str0m::{
    change::SdpOffer,
    format::Codec,
    media::{Frequency, MediaTime, Mid, Pt},
    net::{Protocol, Receive},
    Candidate, Event, IceConnectionState, Input, Output, Rtc, RtcConfig,
};

use crate::annexb::Frame;

const MICROS_TO_TICKS_NUMERATOR: u64 = 90;
const MICROS_TO_TICKS_DENOMINATOR: u64 = 1000;

pub struct Pumped {
    pub transmits: Vec<(SocketAddr, Vec<u8>)>,
    pub timeout: Option<Instant>,
}

pub struct Peer {
    rtc: Rtc,
    pub channel: u16,
    pub alive: bool,
    pub timeout: Option<Instant>,
    connected: bool,
    mid: Option<Mid>,
    pt: Option<Pt>,
    epoch: Option<Instant>,
}

impl Peer {
    pub fn open(
        channel: u16,
        sdp_offer: &str,
        candidate: SocketAddr,
    ) -> Result<(Peer, String), String> {
        let offer = SdpOffer::from_sdp_string(sdp_offer).map_err(|error| error.to_string())?;
        let mut rtc = RtcConfig::new()
            .clear_codecs()
            .enable_h264(true)
            .build(Instant::now());

        let host = Candidate::host(candidate, "udp").map_err(|error| error.to_string())?;
        rtc.add_local_candidate(host);

        let answer = rtc
            .sdp_api()
            .accept_offer(offer)
            .map_err(|error| error.to_string())?;

        let peer = Peer {
            rtc,
            channel,
            alive: true,
            timeout: None,
            connected: false,
            mid: None,
            pt: None,
            epoch: None,
        };
        Ok((peer, answer.to_sdp_string()))
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

    pub fn write_frame(&mut self, frame: &Frame, at: Instant) {
        let Some(mid) = self.mid.filter(|_| self.connected) else {
            return;
        };
        if self.epoch.is_none() && !frame.keyframe {
            return;
        }
        let epoch = *self.epoch.get_or_insert(at);

        let Some(pt) = self.payload_type(mid) else {
            return;
        };

        let micros = at.saturating_duration_since(epoch).as_micros() as u64;
        let ticks = micros * MICROS_TO_TICKS_NUMERATOR / MICROS_TO_TICKS_DENOMINATOR;
        let time = MediaTime::new(ticks, Frequency::NINETY_KHZ);

        let written = self
            .rtc
            .writer(mid)
            .map(|writer| writer.write(pt, at, time, frame.data.clone()));
        if !matches!(written, Some(Ok(()))) {
            self.alive = false;
        }
    }

    fn payload_type(&mut self, mid: Mid) -> Option<Pt> {
        if self.pt.is_none() {
            let writer = self.rtc.writer(mid)?;
            let h264: Vec<_> = writer
                .payload_params()
                .filter(|params| params.spec().codec == Codec::H264)
                .collect();
            let preferred = h264
                .iter()
                .find(|params| params.spec().format.packetization_mode == Some(1));
            self.pt = preferred.or(h264.first()).map(|params| params.pt());
        }
        self.pt
    }

    pub fn pump(&mut self) -> Pumped {
        let mut transmits = vec![];

        let timeout = loop {
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

        Pumped { transmits, timeout }
    }

    fn on_event(&mut self, event: Event) {
        match event {
            Event::MediaAdded(media) => self.mid = Some(media.mid),
            Event::Connected => self.connected = true,
            Event::IceConnectionStateChange(IceConnectionState::Disconnected) => self.alive = false,
            _ => {}
        }
    }
}
