import { noTry } from 'no-try';
import { type RundownEntry } from './query/rundownEntries';

// Plugins set this MIME to JSON matching RundownItemDragPayload on dragstart
export const RUNDOWN_ITEM_DRAG_MIME = 'application/x-cg-rundown-item';

export interface RundownItemDragPayload {
    type: string;
    data?: unknown;
    /** Defaults to "New Rundown Item". */
    title?: string;
    immediate?: boolean;
}

export function parseRundownItemPayload(
    dt: DataTransfer | null,
): RundownItemDragPayload | null {
    if (!dt) return null;
    const raw = dt.getData(RUNDOWN_ITEM_DRAG_MIME);
    if (!raw) return null;
    const [, parsed] = noTry(() => JSON.parse(raw));
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof (parsed as { type?: unknown }).type !== 'string') return null;
    return parsed as RundownItemDragPayload;
}

// getData() is empty during dragover in most browsers, so only types is checked
export function hasRundownItemPayload(dt: DataTransfer | null): boolean {
    if (!dt) return false;
    return Array.from(dt.types).includes(RUNDOWN_ITEM_DRAG_MIME);
}

export interface RundownFileMatchResult {
    actionId: string;
    payload: RundownItemDragPayload;
    path: string;
    mediaId: string;
    destination: string;
}

// Cross-list drops differ from reorders by rundownId vs the receiving list
export const RUNDOWN_REORDER_MIME = 'application/x-cg-rundown-reorder';

export interface RundownReorderPayload {
    rundownId: string;
    entry: RundownEntry;
}

export function hasReorderPayload(dt: DataTransfer | null): boolean {
    if (!dt) return false;
    return Array.from(dt.types).includes(RUNDOWN_REORDER_MIME);
}

export function writeReorderPayload(
    dt: DataTransfer,
    payload: RundownReorderPayload,
): void {
    dt.setData(RUNDOWN_REORDER_MIME, JSON.stringify(payload));
    dt.effectAllowed = 'move';
}

export function readReorderPayload(
    dt: DataTransfer,
): RundownReorderPayload | null {
    const raw = dt.getData(RUNDOWN_REORDER_MIME);
    const [, parsed] = noTry(() => JSON.parse(raw) as RundownReorderPayload);
    if (!parsed?.entry?.id || !parsed.rundownId) return null;
    return parsed;
}

export function isFileDrag(dt: DataTransfer | null): boolean {
    if (!dt) return false;
    return Array.from(dt.types).includes('Files');
}

export const MEDIA_MOVE_DRAG_MIME = 'application/x-cg-media-move';

export interface MediaMoveDragPayload {
    id: string;
}

export function parseMediaMovePayload(
    dt: DataTransfer | null,
): MediaMoveDragPayload | null {
    if (!dt) return null;
    const raw = dt.getData(MEDIA_MOVE_DRAG_MIME);
    if (!raw) return null;
    const [, parsed] = noTry(() => JSON.parse(raw));
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof (parsed as { id?: unknown }).id !== 'string') return null;
    return parsed as MediaMoveDragPayload;
}

export function hasMediaMovePayload(dt: DataTransfer | null): boolean {
    if (!dt) return false;
    return Array.from(dt.types).includes(MEDIA_MOVE_DRAG_MIME);
}
