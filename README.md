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

| Key | Default | Description |
|---|---|---|
| `port` | `5353` | API + web UI port |
| `caspar-path` | — | Path to the CasparCG binary |
| `rundown-dir` | — | Directory for rundown files |
| `routes-dir` | — | Directory for video route files |
| `log-dir` | — | Directory for log files |

## Plugins

Plugins can be placed in a `./plugins/` directory next to the executable. Each plugin can register rundown actions, inject UI panels, and react to CasparCG lifecycle events.
