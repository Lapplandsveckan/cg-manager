use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Command {
    Open {
        id: u64,
        channel: u16,
        sdp_offer: String,
    },
    Close {
        id: u64,
    },
    Ingest {
        channel: u16,
    },
    Shutdown,
}

#[derive(Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Event {
    Opened { id: u64, sdp_answer: String },
    Error { id: u64, message: String },
    IngestReady { channel: u16, port: u16 },
    ChannelIdle { channel: u16 },
    SessionClosed { id: u64 },
}
