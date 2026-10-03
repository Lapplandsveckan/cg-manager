# cg-manager

A service that wraps and supervises a **CasparCG** server, exposing it over a REST/WebSocket API with a built-in web UI. Designed to run alongside CasparCG on the same machine and be deployed as a single self-contained executable.

> **macOS is not supported** for running CasparCG. A mock mode lets the rest of the app run without it for development.

## Features

- Spawn, supervise, and control the CasparCG process (with optional auto-restart)
- REST/WebSocket API for clients on the network
- Built-in web UI served on the same port
- Media scanner compatible with the CasparCG media-scanner API (port `8000`)
- LAN discovery via Bonjour/mDNS (`cg-manager` service type)
- Plugin system for extending functionality
- Rundowns and quick actions
- Video routes (via the built-in `routes` plugin)
- Channel recording to file (via the built-in `recorder` plugin)
- Live WebRTC preview of CasparCG channels
- CasparCG configuration management
- Optional Sentry telemetry (off by default)

## Repository layout

Yarn workspaces monorepo:

| Package | Description |
|---|---|
| `packages/server` (`@cg-manager/server`) | The service, web UI and built-in plugins. |
| `packages/core` (`@lappis/cg-manager`) | Executor, effects, commands and `PluginAPI`. Published to npm for plugin authors and external clients. |

## Running

Run from the repo root:

```sh
yarn start      # development
yarn package    # build a standalone executable (packages/server/out/manager)
yarn format     # format all workspaces
yarn lint       # lint all workspaces
```

## Configuration

`config.json` is read from the working directory on startup and created with defaults if it doesn't exist. Set `CASPAR_DIR` to point at a different directory.

Use `manager config show` to print the effective configuration (secrets redacted) and `manager config keys` to list every field with its type, default value, and description. Nested keys use dotted paths, e.g. `telemetry.dsn`.

| Key | Type | Default | Description |
|---|---|---|---|
| `port` | number | `5353` | TCP port for the API + web UI. |
| `host` | string | `null` | Interface/IP to bind to. `null` = all interfaces; `"127.0.0.1"` = loopback only. |
| `socket-path` | string | `null` | Unix socket / Windows named pipe to listen on instead of TCP. Takes precedence over `host`/`port`. |
| `web` | boolean | `true` | Serve the Next.js web UI. `false` = API-only (web routes 404). |
| `dev` | boolean | `true` in dev | Development mode (affects crash handling). |
| `hide-debug` | boolean | `false` in dev | Hide debug log messages. |
| `pipe-caspar` | boolean | `false` | Pipe CasparCG stdout into the manager console as debug logs. |
| `caspar-path` | string | `null` | Path to the CasparCG installation directory. |
| `caspar-profile` | string | `upstream` | CasparCG build profile: `upstream` (stock) or `lappis` (custom builds). |
| `caspar-auto-restart` | boolean | `true` | Respawn CasparCG with backoff and a retry cap when it exits unexpectedly. |
| `log-dir` | string | `null` | Directory for log files. `null` = no file logging. |
| `db-file` | string | `./media-cache.json` | Path to the media-cache database file. |
| `rundown-dir` | string | `./rundowns` | Directory for rundown files. |
| `plugins-dir` | string | `./plugins` | Directory external plugins load from. |
| `plugin-data-dir` | string | `./plugin-data` | Directory holding one data folder per plugin. |
| `plugin-state-file` | string | `./plugin-state.json` | Path to the persisted plugin enabled/disabled state. |
| `password` | string | `null` | Shared web UI / API password. `null` disables auth entirely. |
| `api-token` | string | `null` | Static bearer token for headless clients (`Authorization: Bearer <token>`). Coexists with or replaces `password`. |
| `preview-stun` | string | `null` | STUN server URL for WebRTC preview ICE. Leave unset for LAN-only use. |
| `telemetry.dsn` | string | `null` | Sentry DSN. `null` disables telemetry entirely. |
| `telemetry.environment` | string | `production` | Sentry environment tag. |
| `telemetry.replays` | boolean | `true` | Capture browser session replays alongside error reports. |
| `telemetry.sample-rate` | number | `1` | Fraction (0-1) of error events sent, for both server and browser. |

> **Security:** with `password` and `api-token` both unset, the API is open to anyone on the network, including plugin upload, which executes code in the manager process. Set one of them before exposing the manager on a shared network.

## Plugins

Plugins can be placed in the `plugins-dir` (`./plugins/` by default) next to the executable. Each plugin can register rundown actions, API routes, raw HTTP handlers, and UI panels, and react to CasparCG lifecycle events (connect/reconnect).

Built-in plugins:

| Plugin | Description |
|---|---|
| `routes` | Video routes: effects, API, rundown action and UI. Other plugins reach it through the `routes` service. |
| `edgeblend` | Edge-blend layout effect. |
| `essentials` | Placeholder for future essentials. |
| `recorder` | Records a channel to MP4 (H.264) or MOV (ProRes 4444, keeps alpha), with download and import-to-media. |

Plugin authors build against the [`@lappis/cg-manager`](packages/core) package.

Use `manager plugins` to manage plugins from the command line:

```
manager plugins list
manager plugins install <file.cgplugin>
manager plugins uninstall <name>
manager plugins enable <name>
manager plugins disable <name>
```

## CLI reference

```
manager plugins <command>   Manage plugins (see above)
manager config show         Print the effective config (secrets redacted)
manager config get <key>    Print the current value of one key
manager config set <key> <val>  Write a value into config.json
manager config keys         List all keys with type, default, and description
```

See [CLAUDE.md](CLAUDE.md) for architecture notes and contributor conventions.
