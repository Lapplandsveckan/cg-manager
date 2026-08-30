import { randomUUID } from 'crypto';

// Server-side only. The browser's crypto.randomUUID() is gated behind a secure
// context, and the web UI is normally served over plain HTTP on a LAN — it is
// `undefined` there, so don't reach for this (or `crypto` directly) in src/web.
export type UUID = string;
export const UUID = {
    generate: randomUUID,
};
