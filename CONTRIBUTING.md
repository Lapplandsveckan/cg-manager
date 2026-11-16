# Contributing

## Setup

Node >= 22.12 and Yarn. From the repo root:

```sh
yarn install
yarn start      # runs the manager in development
```

`yarn start` builds `@lappis/cg-manager` first — the server resolves it to that build, so
it has to exist before the server will run or package.

CasparCG does not run on macOS. A mock mode lets the rest of the app run there, so most
work other than the CasparCG process supervisor itself can be done on a Mac.

## Layout

Yarn workspaces monorepo with normal hoisting — one root `node_modules` and one
`yarn.lock`.

- `packages/server` (`@cg-manager/server`) — the service, the Next.js web UI and the
  built-in plugins. Private, versioned, packaged into a single executable.
- `packages/core` (`@lappis/cg-manager`) — executor, effects, commands and `PluginAPI`.
  Published to npm and versioned independently.

Shared tooling config (`eslint.config.mjs`, `.prettierrc`, `tsconfig.base.json`) lives at
the repo root; both workspaces extend it.

## Conventions

- 4-space indentation, single quotes, semicolons, trailing commas in multiline.
- `max-lines: 500` is enforced — splitting a file is sometimes the first step of adding
  to it.
- Use `noTry` / `noTryAsync` rather than `try`/`catch` for error handling that isn't
  control flow.
- Use `Logger.scope('Subsystem')` for a module's logs. `console.log` is only for the
  logger itself and `src/cli/**`, where stdout is the command's contract.
- Server routes that take input parse it with a zod schema from `src/schemas/`, via
  `parseBody` / `parseParams` in `src/api/validate.ts`. Plugins keep their schemas next to
  their own code.
- Ids come from `UUID.generate()` (`src/util/uuid.ts`), which wraps Node's
  `crypto.randomUUID`. That is server-side only — the browser's version is unavailable
  over plain HTTP.

## Internationalization

The web UI ships English (`en`) and Swedish (`sv`). Strings live in
`packages/server/src/web/src/lib/locales/<lang>/` — `common.json` for the host, one
namespace file per plugin.

Every new user-facing string goes into **both** languages and is rendered through
`useTranslation()` / `t('key')`. No raw string literals in JSX.

## Before opening a pull request

```sh
yarn format
yarn lint
yarn tsc
```

Bump the version in `packages/server/package.json` on every commit, following semver:

- **major** — breaking changes to the API, config, or runtime behaviour
- **minor** — new features and backwards-compatible enhancements
- **patch** — bug fixes, internal refactors, docs

CI reads that version when it creates a release tag, and `GET /api/version` serves it.
Changes to `packages/core` are versioned separately in `packages/core/package.json`.

Keep commit messages to a subject line, in the imperative mood, with no description body.
