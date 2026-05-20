/**
 * Drag contract for adding items to a rundown via drag-and-drop.
 *
 * A plugin (or any other source) makes an element draggable, and on dragstart
 * writes the payload as JSON to the dedicated MIME type below. When the user
 * drops the element on a rundown list, the host parses the payload, fills in
 * a new RundownEntry, and opens the editor modal with the pre-filled values.
 *
 * The host deliberately does NOT export a wrapper component for plugins —
 * the contract is just "set this MIME type to this JSON shape". Plugins are
 * free to use whatever drag implementation they prefer (native HTML5 DnD,
 * react-dnd, dnd-kit, etc.) as long as they honour the contract.
 *
 * Plugin-side example:
 *
 *   const onDragStart = (e: React.DragEvent) => {
 *       e.dataTransfer.setData('application/x-cg-rundown-item', JSON.stringify({
 *           type: 'play-video',
 *           data: { video: 'INTRO.mp4', loop: false },
 *           title: 'Intro',
 *       }));
 *       e.dataTransfer.effectAllowed = 'copy';
 *   };
 *
 *   <div draggable onDragStart={onDragStart}>…</div>
 */

export const RUNDOWN_ITEM_DRAG_MIME = 'application/x-cg-rundown-item';

export interface RundownItemDragPayload {
    /** Registered rundown action type (must match a `registerRundownAction` name). */
    type: string;
    /** Pre-filled item.data. Plugin editors read this when the modal opens. */
    data?: unknown;
    /** Pre-filled item.title. Defaults to "New Rundown Item" if missing. */
    title?: string;
}

/**
 * Read and validate the payload from a DataTransfer. Returns null when the
 * data is missing, isn't JSON, or doesn't include a string `type`.
 */
export function parseRundownItemPayload(dt: DataTransfer | null): RundownItemDragPayload | null {
    if (!dt) return null;
    const raw = dt.getData(RUNDOWN_ITEM_DRAG_MIME);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        if (typeof (parsed as { type?: unknown }).type !== 'string') return null;
        return parsed as RundownItemDragPayload;
    } catch {
        return null;
    }
}

/**
 * True when a DataTransfer carries the rundown-item MIME type. Use this in
 * onDragOver to decide whether to accept the drop — calling getData() on
 * dragover doesn't work in most browsers, so we just check the types list.
 */
export function hasRundownItemPayload(dt: DataTransfer | null): boolean {
    if (!dt) return false;
    return Array.from(dt.types).includes(RUNDOWN_ITEM_DRAG_MIME);
}
