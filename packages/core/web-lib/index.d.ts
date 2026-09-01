/**
 * Type declarations for `@web-lib` — the web component/hook library that
 * cg-manager exposes to plugin UIs at runtime as the global `WebLib`.
 *
 * `./generated/` is GENERATED from `packages/server/src/web/src/lib/index.ts`
 * by `yarn gen:web-lib-types` (packages/server/.lappis/scripts/generate-web-lib-types.js).
 * Do not hand-edit anything under `./generated/` — regenerate it instead.
 * This file itself is the only hand-written part of the surface.
 *
 * There is no runtime code here — the host (cg-manager) provides the
 * implementation via the `@web-lib → WebLib` webpack external. Plugins
 * resolve this file through a tsconfig `paths` alias:
 * `"@web-lib": ["node_modules/@lappis/cg-manager/web-lib"]`.
 */

export * from './generated/web/src/lib';
