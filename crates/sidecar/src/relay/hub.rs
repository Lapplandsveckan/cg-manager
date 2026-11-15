use std::{
    collections::HashMap,
    net::{IpAddr, Ipv4Addr, SocketAddr},
    sync::Arc,
    time::{Duration, Instant},
};

use tokio::{net::UdpSocket, sync::mpsc::UnboundedSender};

use super::{annexb::Frame, ingest, peer::Peer};
use crate::control::{Command, Event};
use crate::normalize::{
    frame::Size,
    pipeline::{Format, Fps, Notice},
    publisher::{start_publisher, OutputSpec, Publisher},
};

const IDLE_WAKE: Duration = Duration::from_secs(1);

pub enum HubMessage {
    Command(Command),
    Frame {
        channel: u16,
        frame: Arc<Frame>,
        at: Instant,
    },
}

pub struct Hub {
    socket: Arc<UdpSocket>,
    candidate: SocketAddr,
    peers: HashMap<u64, Peer>,
    publishers: HashMap<u64, Publisher>,
    ingest_ports: HashMap<u16, u16>,
    sender: UnboundedSender<HubMessage>,
}

pub fn emit(event: &Event) {
    if let Ok(line) = serde_json::to_string(event) {
        println!("{line}");
    }
}

pub fn detect_local_ip() -> IpAddr {
    std::net::UdpSocket::bind("0.0.0.0:0")
        .and_then(|probe| {
            probe
                .connect("192.0.2.1:9")
                .and_then(|_| probe.local_addr())
        })
        .map_or(IpAddr::V4(Ipv4Addr::LOCALHOST), |address| address.ip())
}

impl Hub {
    pub fn new(
        socket: Arc<UdpSocket>,
        public_ip: IpAddr,
        sender: UnboundedSender<HubMessage>,
    ) -> std::io::Result<Hub> {
        let candidate = SocketAddr::new(public_ip, socket.local_addr()?.port());
        Ok(Hub {
            socket,
            candidate,
            peers: HashMap::new(),
            publishers: HashMap::new(),
            ingest_ports: HashMap::new(),
            sender,
        })
    }

    pub async fn receive_datagram(&mut self, data: &[u8], source: SocketAddr) {
        let now = Instant::now();
        let candidate = self.candidate;
        let relayed = self
            .peers
            .values_mut()
            .any(|peer| peer.receive(now, source, candidate, data));
        if !relayed {
            self.publishers
                .values_mut()
                .any(|publisher| publisher.receive(now, source, candidate, data));
        }
        self.pump().await;
    }

    pub async fn dispatch(&mut self, message: HubMessage) -> bool {
        let keep_running = match message {
            HubMessage::Command(command) => self.command(command).await,
            HubMessage::Frame { channel, frame, at } => {
                self.broadcast_frame(channel, &frame, at);
                true
            }
        };
        self.pump().await;
        keep_running
    }

    pub async fn wake(&mut self) {
        let now = Instant::now();
        self.peers.values_mut().for_each(|peer| peer.tick(now));
        self.publishers
            .values_mut()
            .for_each(|publisher| publisher.tick(now));
        self.pump().await;
    }

    pub fn next_deadline(&self) -> Instant {
        let relay_timeouts = self.peers.values().filter_map(|peer| peer.timeout);
        let publish_timeouts = self
            .publishers
            .values()
            .filter_map(|publisher| publisher.timeout);

        relay_timeouts
            .chain(publish_timeouts)
            .min()
            .unwrap_or_else(|| Instant::now() + IDLE_WAKE)
    }

    fn broadcast_frame(&mut self, channel: u16, frame: &Frame, at: Instant) {
        self.peers
            .values_mut()
            .filter(|peer| peer.channel == channel)
            .for_each(|peer| peer.write_frame(frame, at));
    }

    async fn command(&mut self, command: Command) -> bool {
        match command {
            Command::Open {
                id,
                channel,
                sdp_offer,
            } => self.open(id, channel, &sdp_offer),
            Command::Close { id } => self.close(id),
            Command::Ingest { channel } => self.ingest(channel).await,
            Command::Publish { id, sdp_offer } => self.publish(id, &sdp_offer),
            Command::SetOutput {
                id,
                publish_id,
                width,
                height,
                fps_numerator,
                fps_denominator,
                ffmpeg,
                output_args,
            } => {
                let spec = OutputSpec {
                    format: Format {
                        size: Size::even(width, height),
                        fps: Fps {
                            numerator: fps_numerator,
                            denominator: fps_denominator,
                        },
                    },
                    ffmpeg,
                    output_args,
                };
                self.set_output(id, publish_id, &spec);
            }
            Command::ClearOutput { id } => {
                if let Some(publisher) = self.publishers.get_mut(&id) {
                    publisher.clear_output();
                }
            }
            Command::Unpublish { id } => self.unpublish(id, "unpublished"),
            Command::Ping { id } => emit(&Event::Pong {
                id,
                version: env!("CARGO_PKG_VERSION"),
            }),
            Command::Shutdown => return false,
        }
        true
    }

    fn open(&mut self, id: u64, channel: u16, sdp_offer: &str) {
        match Peer::open(channel, sdp_offer, self.candidate) {
            Ok((peer, sdp_answer)) => {
                self.peers.insert(id, peer);
                emit(&Event::Opened { id, sdp_answer });
            }
            Err(message) => emit(&Event::Error { id, message }),
        }
    }

    fn close(&mut self, id: u64) {
        let Some(peer) = self.peers.remove(&id) else {
            return;
        };
        emit(&Event::SessionClosed { id });
        self.report_if_idle(peer.channel);
    }

    async fn ingest(&mut self, channel: u16) {
        if let Some(&port) = self.ingest_ports.get(&channel) {
            return emit(&Event::IngestReady { channel, port });
        }

        match ingest::listen(channel, self.sender.clone()).await {
            Ok(port) => {
                self.ingest_ports.insert(channel, port);
                emit(&Event::IngestReady { channel, port });
            }
            Err(error) => eprintln!("ingest listen failed for channel {channel}: {error}"),
        }
    }

    fn report_if_idle(&self, channel: u16) {
        if self.peers.values().any(|peer| peer.channel == channel) {
            return;
        }
        emit(&Event::ChannelIdle { channel });
    }

    fn publish(&mut self, id: u64, sdp_offer: &str) {
        match start_publisher(sdp_offer, self.candidate) {
            Ok((publisher, sdp_answer)) => {
                self.publishers.insert(id, publisher);
                emit(&Event::Published { id, sdp_answer });
            }
            Err(message) => emit(&Event::Error { id, message }),
        }
    }

    fn set_output(&mut self, id: u64, publish_id: u64, spec: &OutputSpec) {
        let fail = |message: String| emit(&Event::Error { id, message });

        if !spec.format.is_playable() {
            return fail("output size and frame rate must be positive".into());
        }
        let Some(publisher) = self.publishers.get_mut(&publish_id) else {
            return fail("no such publisher".into());
        };

        match publisher.set_output(spec) {
            Ok(()) => emit(&Event::OutputSet { id }),
            Err(message) => fail(message),
        }
    }

    fn unpublish(&mut self, id: u64, reason: &str) {
        if self.publishers.remove(&id).is_none() {
            return;
        }
        let reason = reason.into();
        emit(&Event::PublishClosed { id, reason });
    }

    fn pump_publishers(&mut self) -> Vec<(SocketAddr, Vec<u8>)> {
        let now = Instant::now();
        let mut outgoing = vec![];
        let mut closing = vec![];

        for (&id, publisher) in self.publishers.iter_mut() {
            let pumped = publisher.pump(now);
            outgoing.extend(pumped.transmits);

            for notice in pumped.notices {
                match notice {
                    Notice::Live(Size { width, height }) => {
                        emit(&Event::PublishLive { id, width, height })
                    }
                    Notice::InputChanged(Size { width, height }) => {
                        emit(&Event::PublishInputChanged { id, width, height })
                    }
                    Notice::OutputFailed(reason) => closing.push((id, reason)),
                    Notice::DecodeFailed(_) => {}
                }
            }
            if !publisher.alive {
                closing.push((id, "peer disconnected".into()));
            }
        }

        closing
            .iter()
            .for_each(|(id, reason)| self.unpublish(*id, reason));
        outgoing
    }

    async fn pump(&mut self) {
        let mut outgoing = self.pump_publishers();
        for peer in self.peers.values_mut() {
            let pumped = peer.pump();
            peer.timeout = pumped.timeout;
            outgoing.extend(pumped.transmits);
        }
        for (destination, contents) in outgoing {
            let _ = self.socket.send_to(&contents, destination).await;
        }

        let dead: Vec<u64> = self
            .peers
            .iter()
            .filter(|(_, peer)| !peer.alive)
            .map(|(id, _)| *id)
            .collect();
        dead.into_iter().for_each(|id| self.close(id));
    }
}
