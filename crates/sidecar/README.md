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
| Pace | `pipeline.rs` | Decode, tick and write threads. The encoder reads frame count as time, so a tick lost to a late sleep or a busy writer is made up by repeating the frame it would have shown, up to a second's worth. |
| Encode + mux | `output.rs` | `Output` trait; one ffmpeg child fed raw frames on stdin today. |

Extra control messages:

| Command | Reply |
|---|---|
| `{"type":"publish","id","sdpOffer"}` | `published` with `sdpAnswer`, or `error` |
| `{"type":"set_output","id","publishId","width","height","fpsNumerator","fpsDenominator","ffmpeg","outputArgs"}` | `output_set`, or `error`. A no-op when the format is unchanged. |
| `{"type":"clear_output","id"}` | none; the encoder stops |
| `{"type":"unpublish","id"}` | `publish_closed` |

Unsolicited: `publish_live` (first decoded frame, with the source `width`/`height`), `publish_input_changed` (source size changed), `publish_closed` with a `reason` (peer gone, or ffmpeg exited).

### Trying it

In the manager, set `"ingest-engine": "sidecar"` in `config.json`, start a share from `/ext/screenshare` and show it on a channel. The sink carries nothing until the share is shown. Without CasparCG (`CASPAR_MOCK=1 yarn start`):

```sh
ffplay "udp://127.0.0.1:6000?overrun_nonfatal=1&fifo_size=1000000"
```

Without a browser, feed it a raw H.264 file and script a stall:

```sh
ffmpeg -f lavfi -i testsrc2=size=1000x700:rate=30 -t 4 -c:v libx264 -profile:v baseline -f h264 clip.h264
ffplay "udp://127.0.0.1:6100" &
target/debug/cg-sidecar normalize --input clip.h264 --sink "udp://127.0.0.1:6100?pkt_size=1316" --gap 2:3
```

`--gap 2:3` sends nothing for 3 seconds starting at second 2; the picture should hold and the frame rate stay constant. Other flags: `--width`, `--height`, `--fps`, `--input-fps`, `--ffmpeg`.

### Known gaps

- No audio: a share on the sidecar engine is silent.
- The channel format comes from the saved CasparCG config (`video-mode` per channel), not from the running process. An unrecognised mode falls back to 1920x1080 at 30 fps with a warning in the log.
- A share shown on two channels with different formats follows the most recent one; the other layer has to be played again.
- A sender that disappears is only noticed after about 22 seconds (ICE timeout).
- ffmpeg exiting closes the session instead of being restarted.
- No STUN, so senders outside the LAN cannot connect.
- No server-side thumbnails yet; the sender-posted ones still work.
