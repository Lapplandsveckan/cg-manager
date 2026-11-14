use std::{io, sync::Arc, time::Instant};

use tokio::{
    io::AsyncReadExt,
    net::{TcpListener, TcpStream},
    sync::mpsc::UnboundedSender,
};

use crate::relay::{annexb::Splitter, hub::HubMessage};

const READ_SIZE: usize = 64 * 1024;

pub async fn listen(channel: u16, hub: UnboundedSender<HubMessage>) -> io::Result<u16> {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await?;
    let port = listener.local_addr()?.port();
    tokio::spawn(accept_loop(channel, listener, hub));
    Ok(port)
}

async fn accept_loop(channel: u16, listener: TcpListener, hub: UnboundedSender<HubMessage>) {
    while let Ok((stream, _)) = listener.accept().await {
        tokio::spawn(read_loop(channel, stream, hub.clone()));
    }
}

async fn read_loop(channel: u16, mut stream: TcpStream, hub: UnboundedSender<HubMessage>) {
    let mut splitter = Splitter::default();
    let mut buf = vec![0u8; READ_SIZE];

    loop {
        let read = match stream.read(&mut buf).await {
            Ok(0) | Err(_) => return,
            Ok(read) => read,
        };

        let at = Instant::now();
        for frame in splitter.push(&buf[..read]) {
            let message = HubMessage::Frame {
                channel,
                frame: Arc::new(frame),
                at,
            };
            if hub.send(message).is_err() {
                return;
            }
        }
    }
}
