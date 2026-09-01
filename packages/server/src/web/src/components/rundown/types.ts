import { type RundownEntry } from '../../lib/query/rundownEntries';
import { type RundownItemDragPayload } from '../../lib/dragPayload';

export interface RundownsProps {
    /** Id of the rundown this list renders. Lets a drop tell a same-list
     *  reorder apart from a drag arriving from a different Rundowns
     *  instance (e.g. between the main rundown and a quick-actions list). */
    rundownId: string;
    entries: RundownEntry[];

    onEdit: (entry: RundownEntry) => void;
    onPlay: (entry: RundownEntry) => void;
    /** When provided, a stop button is shown for entries whose action type
     *  has a registered stop handler on the server. */
    onStop?: (entry: RundownEntry) => void;
    onAdd: () => void;
    /** Called with the entry to delete after the user confirms the dialog.
     *  Only surfaced for orphaned items (those whose action type is not
     *  registered on the server). */
    onDelete: (entry: RundownEntry) => void;

    /** Called when a drag payload is dropped onto the list. The handler should
     *  produce a new RundownEntry from the payload (e.g. open the editor modal
     *  with the pre-filled fields). When the user hovered over a specific item
     *  during the drag, `index` is the position in the list where the entry
     *  should be inserted; when omitted (dropped on empty space), the entry
     *  should be appended. Also used (with `immediate: true`) to copy in an
     *  existing entry dragged from a different Rundowns instance. */
    onDropItem?: (payload: RundownItemDragPayload, index?: number) => void;
    /** Called when items have been reordered via drag. Receives the new
     *  ordered list of item ids. */
    onReorder?: (orderedIds: string[]) => void;

    /** Called when the user duplicates an entry via context menu. Receives
     *  the source entry and the index it should be inserted after. */
    onDuplicate?: (entry: RundownEntry, index: number) => void;
    /** Called when the user pastes a copied entry via context menu. Receives
     *  the copied entry and the index it should be inserted after. */
    onPaste?: (entry: RundownEntry, index: number) => void;

    locked?: boolean;
}
