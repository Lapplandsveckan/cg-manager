import type { ManagerApi } from '../api/api';

// Either an i18n key (bare host key, prefixed with `undo.labels.`, or a
// `namespace:key` plugin key resolved via i18next directly) with optional
// interpolation params, or a raw `text` string shown verbatim — the
// convenience path for plugins that would rather not register translations.
export type UndoLabel =
    | { key: string; params?: Record<string, string | number>; text?: never }
    | { key?: never; params?: never; text: string };

export interface UndoContext {
    api: ManagerApi;
    direction: 'undo' | 'redo';
    entry: UndoEntry;
}

export type UndoApply<T = unknown> = (
    state: T,
    ctx: UndoContext,
) => Promise<unknown> | void;

export interface UndoEntry<T = unknown> {
    label: UndoLabel;
    scopes: string[];
    prev: T;
    next: T;
    apply: UndoApply<T>;
    ts: number;
    failCount?: number;
}

export interface BarrierEntry {
    kind: 'barrier';
    label: UndoLabel;
    ts: number;
}

export type StackEntry = UndoEntry | BarrierEntry;

export function isBarrierEntry(entry: StackEntry): entry is BarrierEntry {
    return 'kind' in entry && entry.kind === 'barrier';
}

export function scopeMatches(scope: string, key: string): boolean {
    return scope === key || scope.startsWith(`${key}:`);
}
