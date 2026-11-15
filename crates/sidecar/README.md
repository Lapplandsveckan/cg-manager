# cg-sidecar

Native helper process for cg-manager's WebRTC media paths. The manager spawns it and talks to it over stdin/stdout.

Today it contains the preview relay (`src/relay/`): already-encoded H.264 in over loopback TCP, WebRTC out to browsers. The screen-share normalizer (decode, fixed size and frame rate, re-encode) is planned; see "Planned: screen-share ingest re-encode in the Rust sidecar" in the repo's `CLAUDE.md`.

## Prerequisites

- Rust (stable) from https://rustup.rs
- A C compiler (the crypto dependencies build C sources)

## Developing

Run these from the repo root.

| Command | What it does |
|---|---|
| `yarn start` | Builds the sidecar (debug) and starts the manager. Without `cargo` it warns and continues without the sidecar. |
| `yarn sidecar:build` | Builds the sidecar only. |
| `yarn sidecar:watch` | Rebuilds on change (needs `cargo install cargo-watch`). With `dev` on, the manager restarts the sidecar on its next request after a rebuild. |
| `cargo test --workspace` | Runs the Rust tests. |

The manager looks for the binary in this order:

1. `CG_SIDECAR_PATH`, if set
2. in a packaged build, the copy embedded in the executable, extracted to the system temp dir under `cg-manager/sidecar/<manager version>/`
3. otherwise whichever of `target/debug/` and `target/release/` was built most recently

On start the manager logs `Sidecar <version> ready`, or `Sidecar unavailable: <reason>`. Sidecar stderr appears in the manager log under the `Sidecar` scope.

To poke it by hand:

```sh
echo '{"type":"ping","id":1}' | target/debug/cg-sidecar
```

## Control protocol

One JSON object per line. Commands go in on stdin, events come out on stdout. The sidecar exits when stdin closes.

| Command | Reply |
|---|---|
| `{"type":"ping","id"}` | `{"type":"pong","id","version"}` |
| `{"type":"open","id","channel","sdpOffer"}` | `opened` with `sdpAnswer`, or `error` with `message` |
| `{"type":"close","id"}` | `session_closed` |
| `{"type":"ingest","channel"}` | `ingest_ready` with the loopback TCP `port` to send H.264 to |
| `{"type":"shutdown"}` | none; the process exits |

Unsolicited events: `session_closed` when a peer dies, `channel_idle` when a channel's last peer leaves.

The Node client is `packages/server/src/manager/wrtc/shared/sidecar.ts`. `request()` adds its own `id` and resolves with the first event carrying it (an `error` event rejects), so it only fits `ping` and `open`. Use `send()` for `close`, `ingest` and `shutdown`, and listen to the client's `event` emissions for their results. A command the sidecar cannot parse is only reported on stderr.

## Screen-share normalizer (`src/normalize/`)

Experimental, video only. Takes whatever H.264 a browser sends and emits a fixed-size, constant-frame-rate stream on the sidecar's own clock: the last frame is repeated when nothing new arrives, black is sent before the first frame, and a source of any size is letterboxed into the output size.

The output size and frame rate are not configured. A connected share is decoded but not encoded; the encoder starts when the share is first played, at the size and frame rate of the CasparCG channel it is played on, and stops when nothing plays it any more. A second play on a channel with a different format restarts the encoder at the new format.

| Stage | File | Notes |
|---|---|---|
| WebRTC receive | `publisher.rs` | str0m, receive only. Asks for a keyframe (PLI) on start, packet loss, a dropped access unit or a decode error, at most every 500 ms. |
| Decode | `decoder.rs` | `Decoder` trait; openh264 today. |
| Scale | `frame.rs` | Letterbox into the canonical I420 frame. |
| Pace | `pipeline.rs` | Decode, tick and write threads. A tick the writer is too busy for is dropped and never made up. |
| Encode | `output.rs`, `avi.rs` | `Output` trait; one ffmpeg child fed raw frames on stdin, all-intra MPEG-2 with `low_delay` (without it the encoder holds every frame until the next one). It writes AVI to stdout only because AVI chunks carry their length, so a frame is complete when its last byte arrives. |
| Mux + serve | `sink.rs`, `mkv.rs` | Matroska over loopback TCP, one stream per connected reader. See "Why the sink looks like this". |

Extra control messages:

| Command | Reply |
|---|---|
| `{"type":"publish","id","sdpOffer","sinkPort"}` | `published` with `sdpAnswer`, or `error` |
| `{"type":"set_output","id","publishId","width","height","fpsNumerator","fpsDenominator","ffmpeg"}` | `output_set`, or `error`. A no-op when the format is unchanged. |
| `{"type":"clear_output","id"}` | none; the encoder stops and readers are disconnected |
| `{"type":"unpublish","id"}` | `publish_closed` |

Unsolicited: `publish_live` (first decoded frame, with the source `width`/`height`), `publish_input_changed` (source size changed), `publish_closed` with a `reason` (peer gone, or ffmpeg exited).

### Why the sink looks like this

CasparCG's ffmpeg producer is a file player: it shows one frame per channel tick in timestamp order, fills timestamp gaps with repeats, and never skips ahead. Whatever delay it picks up it keeps until the layer is played again. Three things used to give it delay, and the sink is shaped to avoid each (CasparCG source: `src/modules/ffmpeg/producer/av_input.cpp`, `av_producer.cpp`).

- **The opening probe.** `avformat_find_stream_info` runs with default options and keeps what it read. On MPEG-TS it does not stop until it has read 5 MB or 5 s of stream, then plays that from the start: measured 0.9 s on a busy 1080p50 picture and 3.2 s on a black one, as both start-up time and permanent delay. Matroska states the frame rate in its header, so the probe ends after two frames (about 0.1 s). TCP is what lets each reader get a stream that begins at its own first byte; a new reader is also handed five copies of the current picture, which is what CasparCG wants buffered before it shows anything.
- **Stalls.** Frames that arrive late in a burst are played out at normal speed, so delay ratchets up to the longest stall the stream ever had. Timestamps therefore count the frames a reader was actually sent: a frame that was dropped, at the tick or because the reader was slow, leaves no gap and no backlog.
- **Never catching up.** Nothing on the CasparCG side can be told to skip. Each reader is sent one frame in `DRAIN_INTERVAL` (120) fewer than it consumes, so it runs dry and repeats a frame about every 2.4 s at 50 fps. That is the only lever for removing delay it has already picked up, and it is slow: one second of delay takes two minutes to drain.

Not covered: a stall inside CasparCG itself (its input thread queues 256 packets, five to eight seconds, before TCP pushes back) only drains at that rate. Removing it for good needs a change in CasparCG: drop queued packets when a live input falls behind.

### Trying it

In the manager, set `"ingest-engine": "sidecar"` in `config.json`, start a share from `/ext/screenshare` and show it on a channel. The sink carries nothing until the share is shown. Without CasparCG (`CASPAR_MOCK=1 yarn start`):

```sh
ffplay -fflags nobuffer tcp://127.0.0.1:6000
```

Without a browser, feed it a raw H.264 file and script a stall:

```sh
ffmpeg -f lavfi -i testsrc2=size=1000x700:rate=30 -t 4 -c:v libx264 -profile:v baseline -f h264 clip.h264
target/debug/cg-sidecar normalize --input clip.h264 --port 6100 --gap 2:3 &
ffplay -fflags nobuffer tcp://127.0.0.1:6100
```

`--gap 2:3` sends nothing for 3 seconds starting at second 2; the picture should hold and the frame rate stay constant. Other flags: `--width`, `--height`, `--fps`, `--input-fps`, `--ffmpeg`.

To see what CasparCG's probe will do with a sink, open it the way CasparCG does and read the `frames:` count on the `After avformat_find_stream_info()` line:

```sh
ffprobe -v debug tcp://127.0.0.1:6100 2>&1 | grep "After avformat_find_stream_info"
```

### Known gaps

- No audio: a share on the sidecar engine is silent.
- The channel format comes from the saved CasparCG config (`video-mode` per channel), not from the running process. An unrecognised mode falls back to 1920x1080 at 30 fps with a warning in the log.
- A share shown on two channels with different formats follows the most recent one; the other reader is disconnected and its layer has to be played again.
- A sender that disappears is only noticed after about 22 seconds (ICE timeout).
- ffmpeg exiting restarts the encoder; readers stay connected and see a short hold. The session only closes once it has failed five times in 30 s.
- A paused CasparCG layer stops reading, and resumes several seconds behind.
- No STUN, so senders outside the LAN cannot connect.
- No server-side thumbnails yet; the sender-posted ones still work.
