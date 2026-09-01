import React from 'react';
import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Injections, UI_INJECTION_ZONE } from '../../lib/api/inject';
import { SlotErrorBoundary } from '../SlotErrorBoundary';
import { DefaultRundownItemView } from '../DefaultRundownItem';
import { useContextMenu } from '../ContextMenuProvider';
import { useEntryClipboard } from '../EntryClipboardProvider';
import { normalizeRundownColor } from '../RundownColorPicker';
import { RundownEntryCard } from './RundownEntryCard';
import { rundownEntryMenuItems } from './rundownEntryMenu';
import { type RundownEntry } from '../../lib/query/rundownEntries';

interface RundownListItemProps {
    entry: RundownEntry;
    index: number;
    locked?: boolean;
    isOrphaned: boolean;
    stoppable: boolean;

    onEdit: (entry: RundownEntry) => void;
    onPlay: (entry: RundownEntry) => void;
    onStop?: (entry: RundownEntry) => void;
    onDuplicate?: (entry: RundownEntry, index: number) => void;
    onPaste?: (entry: RundownEntry, index: number) => void;
    /** Context menu "delete" — always opens the confirm dialog directly. */
    onRequestDelete: (entry: RundownEntry) => void;
    /** Card's own delete button, only shown for orphaned entries — re-checks
     *  against a fresh fetch before opening the confirm dialog. */
    onOrphanDelete: (entry: RundownEntry) => void;

    onReorderDragStart?: (
        e: React.DragEvent<HTMLDivElement>,
        entry: RundownEntry,
        height: number,
        offset: number,
    ) => void;
    onReorderDragEnd: (e: React.DragEvent<HTMLDivElement>) => void;
    dropIndicator: 'before' | 'after' | null;
    gapHeight: number;
    isDragging: boolean;
}

export const RundownListItem: React.FC<RundownListItemProps> = ({
    entry,
    index,
    locked,
    isOrphaned,
    stoppable,
    onEdit,
    onPlay,
    onStop,
    onDuplicate,
    onPaste,
    onRequestDelete,
    onOrphanDelete,
    onReorderDragStart,
    onReorderDragEnd,
    dropIndicator,
    gapHeight,
    isDragging,
}) => {
    const { t } = useTranslation('common');
    const { openSurfaceMenu } = useContextMenu();
    const { copy, paste, hasEntry } = useEntryClipboard();

    return (
        <Box
            onContextMenu={e =>
                openSurfaceMenu(
                    e,
                    'rundown-item',
                    {
                        id: entry.id,
                        title: entry.title,
                        type: entry.type,
                        data: entry.data,
                    },
                    rundownEntryMenuItems(t, {
                        entry,
                        index,
                        isOrphaned,
                        onEdit: () => onEdit(entry),
                        onPlay: () => onPlay(entry),
                        onDuplicate,
                        onCopy: copy,
                        onPaste: () => {
                            const copied = paste();
                            if (copied) onPaste?.(copied, index);
                        },
                        onRequestDelete: () => onRequestDelete(entry),
                        hasClipboardEntry: hasEntry,
                    }),
                )
            }
        >
            <SlotErrorBoundary
                label={`rundown-entry:${entry.id}`}
                resetKeys={[entry.id]}
            >
                <RundownEntryCard
                    title={entry.title}
                    locked={locked}
                    disabled={isOrphaned}
                    color={normalizeRundownColor(entry.metadata?.color)}
                    onEdit={() => onEdit(entry)}
                    onPlay={() => onPlay(entry)}
                    onStop={
                        stoppable && onStop ? () => onStop(entry) : undefined
                    }
                    onDelete={
                        isOrphaned ? () => onOrphanDelete(entry) : undefined
                    }
                    onReorderDragStart={
                        onReorderDragStart
                            ? (e, height, offset) =>
                                  onReorderDragStart(e, entry, height, offset)
                            : undefined
                    }
                    onReorderDragEnd={onReorderDragEnd}
                    dropIndicator={dropIndicator}
                    gapHeight={gapHeight || 64}
                    isDragging={isDragging}
                >
                    {!isOrphaned && (
                        <Injections
                            zone={`${UI_INJECTION_ZONE.RUNDOWN_ITEM}.${entry.type}`}
                            props={{ entry }}
                            fallback={<DefaultRundownItemView entry={entry} />}
                        />
                    )}
                </RundownEntryCard>
            </SlotErrorBoundary>
        </Box>
    );
};
