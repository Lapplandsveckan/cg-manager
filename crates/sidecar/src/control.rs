use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
#[serde(
    tag = "type",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
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
    Publish {
        id: u64,
        sdp_offer: String,
        sink_port: u16,
    },
    SetOutput {
        id: u64,
        publish_id: u64,
        width: usize,
        height: usize,
        fps_numerator: u32,
        fps_denominator: u32,
        ffmpeg: String,
    },
    ClearOutput {
        id: u64,
    },
    Unpublish {
        id: u64,
    },
    Ping {
        id: u64,
    },
    Shutdown,
}

#[derive(Serialize)]
#[serde(
    tag = "type",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum Event {
    Pong {
        id: u64,
        version: &'static str,
    },
    Opened {
        id: u64,
        sdp_answer: String,
    },
    Error {
        id: u64,
        message: String,
    },
    IngestReady {
        channel: u16,
        port: u16,
    },
    ChannelIdle {
        channel: u16,
    },
    SessionClosed {
        id: u64,
    },
    Published {
        id: u64,
        sdp_answer: String,
    },
    OutputSet {
        id: u64,
    },
    PublishLive {
        id: u64,
        width: usize,
        height: usize,
    },
    PublishInputChanged {
        id: u64,
        width: usize,
        height: usize,
    },
    PublishClosed {
        id: u64,
        reason: String,
    },
}
