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
| `{"type":"open","id","channel","sdp_offer"}` | `opened` with `sdp_answer`, or `error` with `message` |
| `{"type":"close","id"}` | `session_closed` |
| `{"type":"ingest","channel"}` | `ingest_ready` with the loopback TCP `port` to send H.264 to |
| `{"type":"shutdown"}` | none; the process exits |

Unsolicited events: `session_closed` when a peer dies, `channel_idle` when a channel's last peer leaves.

The Node client is `packages/server/src/manager/wrtc/shared/sidecar.ts`. `request()` adds its own `id` and resolves with the first event carrying it (an `error` event rejects), so it only fits `ping` and `open`. Use `send()` for `close`, `ingest` and `shutdown`, and listen to the client's `event` emissions for their results. A command the sidecar cannot parse is only reported on stderr.
