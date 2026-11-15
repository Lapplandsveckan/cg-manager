use std::{
    io::{self, Write},
    iter,
    net::{Ipv4Addr, Shutdown, SocketAddr, TcpListener, TcpStream},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc::{self, Receiver, SyncSender, TrySendError},
        Arc, Mutex, MutexGuard, PoisonError,
    },
    thread::{self, JoinHandle},
};

use super::{mkv, pipeline::Format};

const PENDING_READER_FRAMES: usize = 2;
// CasparCG shows nothing until it has buffered a few frames.
pub const OPENING_FRAMES: usize = 5;
// CasparCG never skips ahead, so it only loses delay by running dry: each
// reader is sent one frame in this many fewer than it consumes.
pub const DRAIN_INTERVAL: usize = 120;

#[derive(Clone)]
struct Encoded {
    format: Format,
    frame: Arc<Vec<u8>>,
}

struct Reader {
    frames: SyncSender<Encoded>,
    stream: TcpStream,
}

#[derive(Default)]
struct Shared {
    latest: Option<Encoded>,
    readers: Vec<Reader>,
}

fn lock(shared: &Mutex<Shared>) -> MutexGuard<'_, Shared> {
    shared.lock().unwrap_or_else(PoisonError::into_inner)
}

fn is_drained(live_index: usize) -> bool {
    live_index % DRAIN_INTERVAL == DRAIN_INTERVAL - 1
}

pub fn reader_sequence<T: Clone>(
    latest: Option<T>,
    live: impl Iterator<Item = T>,
) -> impl Iterator<Item = T> {
    let undrained = live
        .enumerate()
        .filter(|(index, _)| !is_drained(*index))
        .map(|(_, frame)| frame);
    let mut frames = latest.into_iter().chain(undrained);
    let opening = frames
        .next()
        .into_iter()
        .flat_map(|first| iter::repeat_n(first, OPENING_FRAMES));

    opening.chain(frames)
}

// Timestamps count the frames this reader was sent: CasparCG fills a gap with
// repeats and plays them out as delay.
fn serve_reader(
    mut stream: &TcpStream,
    latest: Option<Encoded>,
    live: Receiver<Encoded>,
) -> io::Result<()> {
    stream.set_nodelay(true)?;

    let mut frames = reader_sequence(latest, live.into_iter())
        .enumerate()
        .peekable();
    let Some((_, first)) = frames.peek() else {
        return Ok(());
    };
    let format = first.format;
    stream.write_all(&mkv::header(&format))?;

    for (sent, encoded) in frames {
        if encoded.format != format {
            return Ok(());
        }

        let prefix = mkv::cluster_prefix(&format, sent as u64, encoded.frame.len());
        stream.write_all(&prefix)?;
        stream.write_all(&encoded.frame)?;
    }
    Ok(())
}

fn accept_loop(listener: TcpListener, shared: Arc<Mutex<Shared>>, stop: Arc<AtomicBool>) {
    for stream in listener.incoming() {
        if stop.load(Ordering::Relaxed) {
            return;
        }
        let Ok(stream) = stream else {
            continue;
        };
        let Ok(writer) = stream.try_clone() else {
            continue;
        };

        let (frames, live) = mpsc::sync_channel(PENDING_READER_FRAMES);
        let mut shared = lock(&shared);
        let latest = shared.latest.clone();
        shared.readers.push(Reader { frames, stream });
        thread::spawn(move || {
            let _ = serve_reader(&writer, latest, live);
            let _ = writer.shutdown(Shutdown::Both);
        });
    }
}

fn is_gone(sent: Result<(), TrySendError<Encoded>>) -> bool {
    matches!(sent, Err(TrySendError::Disconnected(_)))
}

#[derive(Clone)]
pub struct Feed(Arc<Mutex<Shared>>);

impl Feed {
    pub fn publish(&self, format: Format, frame: Vec<u8>) {
        let encoded = Encoded {
            format,
            frame: Arc::new(frame),
        };

        let mut shared = lock(&self.0);
        shared
            .readers
            .retain(|reader| !is_gone(reader.frames.try_send(encoded.clone())));
        shared.latest = Some(encoded);
    }
}

pub struct Sink {
    shared: Arc<Mutex<Shared>>,
    address: SocketAddr,
    stop: Arc<AtomicBool>,
    accept: Option<JoinHandle<()>>,
}

impl Sink {
    pub fn bind(port: u16) -> io::Result<Sink> {
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, port))?;
        let address = listener.local_addr()?;
        let shared = Arc::new(Mutex::new(Shared::default()));
        let stop = Arc::new(AtomicBool::new(false));

        let accept = {
            let (shared, stop) = (shared.clone(), stop.clone());
            thread::spawn(move || accept_loop(listener, shared, stop))
        };

        Ok(Sink {
            shared,
            address,
            stop,
            accept: Some(accept),
        })
    }

    pub fn feed(&self) -> Feed {
        Feed(self.shared.clone())
    }

    // Shut down rather than dropped: a reader that stopped reading leaves its
    // writer blocked, and only closing the socket under it gets it out.
    pub fn disconnect_readers(&self) {
        let dropped = std::mem::take(&mut *lock(&self.shared));
        for reader in dropped.readers {
            let _ = reader.stream.shutdown(Shutdown::Both);
        }
    }
}

impl Drop for Sink {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
        self.disconnect_readers();

        // The accept loop only looks at the flag when a connection arrives.
        let _ = TcpStream::connect(self.address);
        if let Some(accept) = self.accept.take() {
            let _ = accept.join();
        }
    }
}
