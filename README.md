# cg-manager

A service that wraps and supervises a **CasparCG** server, exposing it over a REST/WebSocket API with a built-in web UI. Designed to run alongside CasparCG on the same machine and be deployed as a single self-contained executable.

> **macOS is not supported.**

## Features

- Spawn, supervise, and control the CasparCG process
- REST/WebSocket API for clients on the network
- Built-in web UI served on the same port
- Media scanner compatible with the CasparCG media-scanner API
- LAN discovery via UDP broadcast
- Plugin system for extending functionality
- Rundown and video route management
- Live preview of CasparCG channels
- CasparCG configuration management

## Running

```sh
yarn start      # development
yarn package    # build a standalone executable
```

The service reads `config.json` from the working directory on startup, creating it with defaults if it doesn't exist. Set `CASPAR_DIR` to point at a different directory.

## Configuration

`config.json` is read from the working directory on startup and created with defaults if it doesn't exist. Set `CASPAR_DIR` to point at a different directory.

Use `manager config show` to print the effective configuration and `manager config keys` to list every field with its type, default value, and description.

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
| `log-dir` | string | `null` | Directory for log files. `null` = no file logging. |
| `db-file` | string | `./media-cache.json` | Path to the media-cache database file. |
| `rundown-dir` | string | `./rundowns` | Directory for rundown files. |
| `routes-dir` | string | `./routes` | Directory for video route files. |
| `plugins-dir` | string | `./plugins` | Directory external plugins load from. |
| `plugin-state-file` | string | `./plugin-state.json` | Path to the persisted plugin enabled/disabled state. |
| `password` | string | `null` | Shared web UI / API password. `null` disables auth entirely. |
| `api-token` | string | `null` | Static bearer token for headless clients (`Authorization: Bearer <token>`). Coexists with or replaces `password`. |
| `preview-stun` | string | `null` | STUN server URL for WebRTC preview ICE. Leave unset for LAN-only use. |

## Plugins

Plugins can be placed in a `./plugins/` directory next to the executable. Each plugin can register rundown actions, inject UI panels, and react to CasparCG lifecycle events.

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
