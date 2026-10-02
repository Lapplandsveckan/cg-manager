import { type RundownEntry } from '../../lib/query/rundownEntries';
import { type RundownItemDragPayload } from '../../lib/dragPayload';

export interface RundownsProps {
    rundownId: string;
    entries: RundownEntry[];

    onEdit: (entry: RundownEntry) => void;
    onPlay: (entry: RundownEntry) => void;
    onStop?: (entry: RundownEntry) => void;
    onAdd: () => void;
    onDelete: (entry: RundownEntry) => void;

    onDropItem?: (payload: RundownItemDragPayload, index?: number) => void;
    onReorder?: (orderedIds: string[]) => void;

    onDuplicate?: (entry: RundownEntry, index: number) => void;
    onPaste?: (entry: RundownEntry, index: number) => void;

    locked?: boolean;
}
