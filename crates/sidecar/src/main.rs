mod control;
mod ice;
mod normalize;
mod relay;

use std::{
    io,
    net::{IpAddr, SocketAddr},
    sync::Arc,
};

use tokio::{
    io::{AsyncBufReadExt, BufReader},
    net::UdpSocket,
    sync::mpsc::{self, UnboundedSender},
    time::Instant,
};

use control::Command;
use relay::hub::{detect_local_ip, Endpoint, Hub, HubMessage};

const DATAGRAM_SIZE: usize = 2048;

struct Args {
    udp_port: u16,
    host_ips: Vec<IpAddr>,
}

fn parse_args() -> Args {
    let args: Vec<String> = std::env::args().collect();
    let values = |flag: &str| -> Vec<String> {
        args.windows(2)
            .filter(|pair| pair[0] == flag)
            .map(|pair| pair[1].clone())
            .collect()
    };

    Args {
        udp_port: values("--udp-port")
            .first()
            .and_then(|port| port.parse().ok())
            .unwrap_or(0),
        host_ips: values("--host-ip")
            .iter()
            .filter_map(|ip| ip.parse().ok())
            .collect(),
    }
}

// One socket per advertised address, so a datagram's real destination is known
// from the socket it arrived on and a reply leaves from the address the sender
// reached.
async fn bind_endpoints(host_ips: &[IpAddr], port: u16) -> io::Result<Vec<Endpoint>> {
    if host_ips.is_empty() {
        let socket = UdpSocket::bind(("0.0.0.0", port)).await?;
        let candidate = SocketAddr::new(detect_local_ip(), socket.local_addr()?.port());
        return Ok(vec![Endpoint {
            socket: Arc::new(socket),
            candidate,
        }]);
    }

    let mut endpoints = vec![];
    for &ip in host_ips {
        match UdpSocket::bind((ip, port)).await {
            Ok(socket) => endpoints.push(Endpoint {
                candidate: socket.local_addr()?,
                socket: Arc::new(socket),
            }),
            Err(error) => eprintln!("could not bind {ip}:{port}: {error}"),
        }
    }
    if endpoints.is_empty() {
        return Err(io::Error::other("no host address could be bound"));
    }
    Ok(endpoints)
}

async fn receive_datagrams(endpoint: Endpoint, sender: UnboundedSender<HubMessage>) {
    let mut datagram = vec![0u8; DATAGRAM_SIZE];

    while let Ok((length, source)) = endpoint.socket.recv_from(&mut datagram).await {
        let message = HubMessage::Datagram {
            data: datagram[..length].to_vec(),
            source,
            destination: endpoint.candidate,
        };
        if sender.send(message).is_err() {
            return;
        }
    }
}

async fn forward_commands(sender: UnboundedSender<HubMessage>) {
    let mut lines = BufReader::new(tokio::io::stdin()).lines();

    while let Ok(Some(line)) = lines.next_line().await {
        match serde_json::from_str::<Command>(&line) {
            Ok(command) => {
                let _ = sender.send(HubMessage::Command(command));
            }
            Err(error) => eprintln!("bad command: {error}"),
        }
    }
    let _ = sender.send(HubMessage::Command(Command::Shutdown));
}

fn main() -> io::Result<()> {
    let args: Vec<String> = std::env::args().collect();
    if args.get(1).is_some_and(|command| command == "normalize") {
        return normalize::cli::run(&args).map_err(io::Error::other);
    }

    tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()?
        .block_on(relay_main())
}

async fn relay_main() -> io::Result<()> {
    str0m::crypto::from_feature_flags().install_process_default();

    let args = parse_args();
    let endpoints = bind_endpoints(&args.host_ips, args.udp_port).await?;

    let (sender, mut receiver) = mpsc::unbounded_channel();
    let mut hub = Hub::new(&endpoints, sender.clone());
    tokio::spawn(forward_commands(sender.clone()));
    for endpoint in endpoints {
        tokio::spawn(receive_datagrams(endpoint, sender.clone()));
    }

    loop {
        let deadline = Instant::from_std(hub.next_deadline());
        tokio::select! {
            message = receiver.recv() => {
                let Some(message) = message else { break };
                if !hub.dispatch(message).await {
                    break;
                }
            }
            _ = tokio::time::sleep_until(deadline) => hub.wake().await,
        }
    }
    Ok(())
}
