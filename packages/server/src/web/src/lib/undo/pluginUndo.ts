import { type UndoEntry, type UndoLabel } from './types';
import { invalidate, record, recordBarrier } from './undoStore';

// `scopes`/`invalidateKeys`/`keys` below are always plain, unscoped keys
// (e.g. `slide:${id}`, not `plugin:my-plugin:slide:${id}`) — the wrapper
// applies the `plugin:<pluginName>:` prefix itself, so callers should never
// pass an already-`scope()`-d key into these.
export interface PluginUndoAPI {
    // Namespaces a plugin-owned key under `plugin:<pluginName>:`, matching
    // the `route:`/`rundown:`/`config` convention the host uses so a
    // plugin's undo scopes can never collide with the host's or another
    // plugin's.
    scope(key: string): string;
    record<T>(entry: Omit<UndoEntry<T>, 'ts'>): void;
    recordBarrier(label: UndoLabel, invalidateKeys: string[]): void;
    // Drops any of this plugin's stack entries touching these keys — call
    // from a listener on the plugin's own broadcast topic when another
    // client's write changes state an entry depends on.
    invalidate(keys: string[]): void;
}

export function createPluginUndo(pluginName: string): PluginUndoAPI {
    const scope = (key: string) => `plugin:${pluginName}:${key}`;

    return {
        scope,
        record: entry => record({ ...entry, scopes: entry.scopes.map(scope) }),
        recordBarrier: (label, keys) => recordBarrier(label, keys.map(scope)),
        invalidate: keys => invalidate(keys.map(scope)),
    };
}
