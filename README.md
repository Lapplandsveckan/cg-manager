# cg-manager

[![Latest release](https://img.shields.io/github/v/release/Lapplandsveckan/cg-manager?label=release)](https://github.com/Lapplandsveckan/cg-manager/releases/latest)
[![npm](https://img.shields.io/npm/v/%40lappis%2Fcg-manager?label=%40lappis%2Fcg-manager)](https://www.npmjs.com/package/@lappis/cg-manager)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**A plugin-first control platform for CasparCG. Build your show once, then anyone can run it.**

CasparCG is a playout server driven by AMCP commands against numbered channels and
layers. That is a fine machine interface and a poor human one. cg-manager puts a
programmable layer on top of it and splits the work in two.

The **plugin designer** builds the show: effects that know how to put something on
screen, rundown actions that trigger them, UI panels for the operator, and whatever
integrations the production needs. They write that once, against a typed plugin API,
and never hard-code a layer number.

The **operator** runs the show from a browser. They see a rundown and a set of buttons,
press them in order, and never learn what AMCP is. When something needs to change
mid-event, it changes in the plugin, not in a pile of hand-typed commands.

## Core concepts

**Effects.** An effect is one self-contained thing on screen — a video, a title, a
colour fill, a video with a logo bug over it. It has `activate()`, `deactivate()` and
`dispose()`, and it allocates its own layers when it is constructed. Plugin code never
names a layer number.

**Effect groups.** Effects live in named, ordered groups on a channel, addressed as
`"<casparChannel>:<groupName>"` — `api.getEffectGroup('1:lower-thirds')`. Group order is
z-order, and the allocator assigns the real CasparCG layer numbers and reshuffles them
as effects come and go, so two effects cannot collide on a layer.

**Rundowns and actions.** A rundown is the operator's running order. Each item is
`{ title, type, data }`, where `type` names a registered rundown action. The action
turns the item into an effect; an optional `stop` handler tears it down again.

**Plugins.** Everything beyond the core is a plugin: effects, rundown actions, protocol
routes, raw HTTP handlers, injected UI, Companion actions and feedbacks, services and
contribution points other plugins extend, and hooks on the CasparCG connect/reconnect
lifecycle. Plugins can extend or replace most of the application.

A whole feature — an effect, and the rundown action that plays it — is about this much
code:

```ts
import {
    CasparPlugin,
    ClearCommand,
    Effect,
    type EffectGroup,
    PlayCommand,
} from '@lappis/cg-manager';

interface StingerOptions {
    video: string;
}

class StingerEffect extends Effect {
    public constructor(
        group: EffectGroup,
        private options: StingerOptions,
    ) {
        super(group);
        this.allocateLayers();
    }

    public activate() {
        if (!super.activate()) return;

        const cmd = PlayCommand.video(this.options.video);
        cmd.allocate(this.layers[0]);

        return this.executor.execute(cmd);
    }

    public deactivate() {
        if (!super.deactivate()) return;
        return this.executor.execute(new ClearCommand(this.layers[0]));
    }
}

export default class StingerPlugin extends CasparPlugin {
    public static get pluginName() {
        return 'stinger';
    }

    private active = new Map<string, StingerEffect>();

    protected onEnable() {
        this.api.registerEffect(
            'stinger',
            (group, options) =>
                new StingerEffect(group, options as StingerOptions),
        );

        this.api.registerRundownAction(
            'play-stinger',
            item => {
                const effect = this.api.createEffect<StingerEffect>(
                    'stinger',
                    '1:stingers',
                    item.data,
                );

                effect.activate();
                this.active.set(item.id, effect);
            },
            {
                stop: item => {
                    this.active.get(item.id)?.dispose();
                    this.active.delete(item.id);
                },
            },
        );
    }
}
```

The operator now has a "play-stinger" item they can drop into any rundown.

## Proven in production

cg-manager has run Lapplandsveckan, a multi-day conference, for three years. Sessions
are operated by volunteers — including kids — while the graphics designer is somewhere
else entirely. That only works because the hard part was done once, up front, by
someone who understood the graphics.

The event's own plugin is built entirely on the public plugin API, with no privileged
access to the host. That is deliberate: if the flagship production can be built from
outside, the core stays generic and so can yours.

## Quick start

> CasparCG itself does not run on **macOS**. A mock mode lets the rest of cg-manager run
> on macOS for development.

1. **Get the binary.** Download `manager` from the
   [latest release](https://github.com/Lapplandsveckan/cg-manager/releases/latest). The
   published artifact is Linux x64; on Windows, build it yourself with `yarn package`
   (see [Development](#development)).

   ```sh
   chmod +x manager
   ```

2. **Run it once** to write a `config.json` into the working directory:

   ```sh
   ./manager
   ```

3. **Set a password before anything else.** With both `password` and `api-token` unset,
   the API is open to everyone on the network — including plugin upload, which executes
   code inside the manager process.

   ```sh
   ./manager config set password <secret>
   ```

4. **Point it at CasparCG** and restart:

   ```sh
   ./manager config set caspar-path /path/to/casparcg
   ./manager
   ```

5. **Open the UI** at `http://localhost:5353`, pick a channel and play something.

## Plugins

A plugin is a class extending `CasparPlugin` with a static `pluginName`. From
`this.api` it can:

- register **effects** and create them in any effect group
- register **rundown actions**, with optional file matching for drag-and-drop
- register **protocol routes** under `plugin/<name>/…` and **broadcast** to clients
- mount **raw Express handlers** under `/api/plugin-http/<name>/` for downloads, uploads
  and webhooks
- inject **UI** into the host app — whole pages, rundown editors, bottom-panel tabs,
  context menus, or a global mount
- register **Companion** (Bitfocus) actions and feedbacks
- publish **services** and **contribution points** for other plugins to use or extend
- hook **CasparCG lifecycle** events (connect, reconnect, status) and rebuild its state
  after a restart
- claim its own **data and temp directories**, and register media or template folders

Built-in plugins:

| Plugin | Description |
|---|---|
| `routes` | Video routes: the `video`, `route`, `color` and `decklink` effects, persistence, API, rundown action and UI. Other plugins reach it through the `routes` service. |
| `edgeblend` | Projector edge-blend layouts: named layouts, overlap geometry and an editor UI. |
| `recorder` | Records a channel to MP4 (H.264) or MOV (ProRes 4444, keeps alpha), with download and import-to-media. |

### Installing plugins

External plugins are loaded from `plugins-dir` (`./plugins/` by default), next to the
executable:

```
manager plugins list
manager plugins install <file.cgplugin>
manager plugins uninstall <name>
manager plugins enable <name>
manager plugins disable <name>
```

### Write your first plugin

Build against [`@lappis/cg-manager`](https://www.npmjs.com/package/@lappis/cg-manager),
the same package the built-in plugins use — there is no private API. The snippet under
[Core concepts](#core-concepts) is a complete, working plugin; for a real one to read,
`packages/server/src/plugins/internal/edgeblend/` is the smallest.

The package is pre-1.0 (`0.x`) and follows semver, which at `0.x` means **minor
releases may break**. Pin the version you build against and read the release notes
before bumping.

## Features

Beyond plugins and rundowns, the manager handles the infrastructure around CasparCG:

- Spawns, supervises and restarts the CasparCG process (with optional auto-restart)
- REST/WebSocket API for clients on the network, plus a built-in web UI on the same port
- Media scanner compatible with the CasparCG media-scanner API (port `8000`)
- LAN discovery via Bonjour/mDNS (`cg-manager` service type)
- Live WebRTC preview of CasparCG channels
- CasparCG configuration management (read, edit and round-trip `casparcg.config`)
- Branding: name, tagline, accent colour and landing page are config keys, so the UI an
  operator sees can be the production's, not ours
- Optional Sentry telemetry (off by default)

## Configuration

`config.json` is read from the working directory on startup and created with defaults if
it doesn't exist. Set `CASPAR_DIR` to run against a different directory.

Use `manager config show` to print the effective configuration (secrets redacted) and
`manager config keys` to list every field with its type, default value, and description.
Nested keys use dotted paths, e.g. `telemetry.dsn`.

### Network

| Key | Type | Default | Description |
|---|---|---|---|
| `port` | number | `5353` | TCP port for the API + web UI. |
| `host` | string | `null` | Interface/IP to bind to. `null` = all interfaces; `"127.0.0.1"` = loopback only. |
| `socket-path` | string | `null` | Unix socket / Windows named pipe to listen on instead of TCP. Takes precedence over `host`/`port`. |
| `web` | boolean | `true` | Serve the Next.js web UI. `false` = API-only (web routes 404). |

### Authentication

See the [security note in Quick start](#quick-start) — with both of these unset, the API
is unauthenticated.

| Key | Type | Default | Description |
|---|---|---|---|
| `password` | string | `null` | Shared web UI / API password. `null` disables auth entirely. |
| `api-token` | string | `null` | Static bearer token for headless clients (`Authorization: Bearer <token>`). Coexists with or replaces `password`. |

### CasparCG

| Key | Type | Default | Description |
|---|---|---|---|
| `caspar-path` | string | `null` | Path to the CasparCG installation directory. |
| `caspar-profile` | string | `upstream` | CasparCG build profile: `upstream` (stock) or `lappis` (custom builds). |
| `caspar-auto-restart` | boolean | `true` | Respawn CasparCG with backoff and a retry cap when it exits unexpectedly. |

### Storage

| Key | Type | Default | Description |
|---|---|---|---|
| `db-file` | string | `./media-cache.json` | Path to the media-cache database file. |
| `rundown-dir` | string | `./rundowns` | Directory for rundown files. |
| `plugins-dir` | string | `./plugins` | Directory external plugins load from. |
| `plugin-data-dir` | string | `./plugin-data` | Directory holding one data folder per plugin. |
| `plugin-state-file` | string | `./plugin-state.json` | Path to the persisted plugin enabled/disabled state. |

### Logging and development

| Key | Type | Default | Description |
|---|---|---|---|
| `dev` | boolean | `true` in dev | Development mode (affects crash handling). |
| `hide-debug` | boolean | `false` in dev | Hide debug log messages. |
| `log-dir` | string | `null` | Directory for log files. `null` = no file logging. |
| `pipe-caspar` | boolean | `false` | Pipe CasparCG stdout into the manager console as debug logs. |

### Preview

| Key | Type | Default | Description |
|---|---|---|---|
| `preview-stun` | string | `null` | STUN server URL for WebRTC preview ICE. Leave unset for LAN-only use. |

### Branding

Not written into a freshly seeded `config.json` — add them by hand or with
`manager config set`.

| Key | Type | Default | Description |
|---|---|---|---|
| `brand.name` | string | `null` | Product name shown in the navbar, login page and browser title. `null` = "CG Manager". |
| `brand.tagline` | string | `null` | Line under the product name. Also accepts a per-language object, e.g. `{"en": "…", "sv": "…"}`. |
| `brand.accent` | string | `null` | Primary accent colour as `#rrggbb`. `null` = default copper. |
| `brand.home` | string | `null` | Path the root URL redirects to, e.g. `/ext/routes`. `null` = `/play`. |

### Telemetry

| Key | Type | Default | Description |
|---|---|---|---|
| `telemetry.dsn` | string | `null` | Sentry DSN. `null` disables telemetry entirely. |
| `telemetry.environment` | string | `production` | Sentry environment tag. |
| `telemetry.replays` | boolean | `true` | Capture browser session replays alongside error reports. |
| `telemetry.sample-rate` | number | `1` | Fraction (0-1) of error events sent, for both server and browser. |

## CLI reference

```
manager plugins <command>       Manage plugins (see above)
manager config show             Print the effective config (secrets redacted)
manager config get <key>        Print the current value of one key
manager config set <key> <val>  Write a value into config.json
manager config keys             List all keys with type, default, and description
```

## Development

Yarn workspaces monorepo:

| Package | Description |
|---|---|
| `packages/server` (`@cg-manager/server`) | The service, web UI and built-in plugins. |
| `packages/core` (`@lappis/cg-manager`) | Executor, effects, commands and `PluginAPI`. Published to npm for plugin authors and external clients. |

Run from the repo root:

```sh
yarn start      # development
yarn package    # build a standalone executable (packages/server/out/manager)
yarn format     # format all workspaces
yarn lint       # lint all workspaces
```

See [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## Roadmap

Planned, not shipped:

- **Fleet mode** — a central control plane managing several per-machine managers as one
  fleet, with aggregated media, rundowns and cross-machine routing.

## Support and custom plugins

Paid support and custom plugin development are available — if you want a show built, or
an integration with gear or a data source you already have, get in touch at
<eliyah@sundstroem.com>.

Bugs and feature requests belong in
[GitHub issues](https://github.com/Lapplandsveckan/cg-manager/issues).

## License

MIT — see [LICENSE](LICENSE). The whole stack, plugin API included, is MIT licensed, so
an organisation running cg-manager keeps full control of its production regardless of
what happens upstream.
