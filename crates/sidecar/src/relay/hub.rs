use std::{
    collections::HashMap,
    net::{IpAddr, Ipv4Addr, SocketAddr},
    sync::Arc,
    time::{Duration, Instant},
};

use tokio::{net::UdpSocket, sync::mpsc::UnboundedSender};

use super::{annexb::Frame, ingest, peer::Peer};
use crate::control::{Command, Event};

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
            ingest_ports: HashMap::new(),
            sender,
        })
    }

    pub async fn receive_datagram(&mut self, data: &[u8], source: SocketAddr) {
        let now = Instant::now();
        let candidate = self.candidate;
        self.peers
            .values_mut()
            .any(|peer| peer.receive(now, source, candidate, data));
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
        self.pump().await;
    }

    pub fn next_deadline(&self) -> Instant {
        self.peers
            .values()
            .filter_map(|peer| peer.timeout)
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

    async fn pump(&mut self) {
        let mut outgoing = vec![];
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
