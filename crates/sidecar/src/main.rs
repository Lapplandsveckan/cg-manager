mod control;
mod relay;

use std::{net::IpAddr, sync::Arc};

use tokio::{
    io::{AsyncBufReadExt, BufReader},
    net::UdpSocket,
    sync::mpsc::{self, UnboundedSender},
    time::Instant,
};

use control::Command;
use relay::hub::{detect_local_ip, Hub, HubMessage};

struct Args {
    udp_port: u16,
    public_ip: Option<IpAddr>,
}

fn parse_args() -> Args {
    let args: Vec<String> = std::env::args().collect();
    let value = |flag: &str| {
        args.iter()
            .position(|arg| arg == flag)
            .and_then(|index| args.get(index + 1))
            .cloned()
    };

    Args {
        udp_port: value("--udp-port")
            .and_then(|port| port.parse().ok())
            .unwrap_or(0),
        public_ip: value("--public-ip").and_then(|ip| ip.parse().ok()),
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

#[tokio::main(flavor = "current_thread")]
async fn main() -> std::io::Result<()> {
    str0m::crypto::from_feature_flags().install_process_default();

    let args = parse_args();
    let socket = Arc::new(UdpSocket::bind(("0.0.0.0", args.udp_port)).await?);
    let public_ip = args.public_ip.unwrap_or_else(detect_local_ip);

    let (sender, mut receiver) = mpsc::unbounded_channel();
    let mut hub = Hub::new(socket.clone(), public_ip, sender.clone())?;
    tokio::spawn(forward_commands(sender));

    let mut datagram = vec![0u8; 2048];
    loop {
        let deadline = Instant::from_std(hub.next_deadline());
        tokio::select! {
            received = socket.recv_from(&mut datagram) => {
                let Ok((length, source)) = received else { continue };
                hub.receive_datagram(&datagram[..length], source).await;
            }
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
