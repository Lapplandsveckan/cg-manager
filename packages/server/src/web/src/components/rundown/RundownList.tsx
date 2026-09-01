import { Box, Button, Stack, Typography, alpha } from '@mui/material';
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next/pages';
import { useDragAutoScroll } from '../../lib/hooks/useDragAutoScroll';
import {
    useRundownActionsQuery,
    useRundownTypesQuery,
} from '../../lib/query/rundownMeta';
import { useRundownDropzone } from '../../hooks/useRundownDropzone';
import { useRundownFileDrop } from '../../hooks/useRundownFileDrop';
import { useRundownReorder } from '../../hooks/useRundownReorder';
import { useContextMenu } from '../ContextMenuProvider';
import { useEntryClipboard } from '../EntryClipboardProvider';
import { UploadModal } from '../Upload';
import { DeleteEntryModal } from './DeleteEntryModal';
import { RundownListItem } from './RundownListItem';
import { type RundownsProps } from './types';
import { type RundownEntry } from '../../lib/query/rundownEntries';

export const Rundowns: React.FC<RundownsProps> = ({
    rundownId,
    entries,
    onEdit,
    onPlay,
    onStop,
    onAdd,
    onDelete,
    onDropItem,
    onReorder,
    onDuplicate,
    onPaste,
    locked,
}) => {
    const { t } = useTranslation('common');
    const { openMenu } = useContextMenu();
    const { paste, hasEntry } = useEntryClipboard();
    const [pendingDelete, setPendingDelete] = useState<RundownEntry | null>(
        null,
    );

    // Kept fresh by useRundownMetaSync (QuerySync): invalidated whenever
    // CasparCG restarts or the plugin list changes, since both re-register
    // the available action types.
    const { data: types, refetch: refetchTypes } = useRundownTypesQuery();
    const { data: actionDescriptors } = useRundownActionsQuery();
    const activeTypes = useMemo(() => (types ? new Set(types) : null), [types]);
    const stoppableTypes = useMemo(
        () =>
            new Set(
                (actionDescriptors ?? []).filter(d => d.hasStop).map(d => d.id),
            ),
        [actionDescriptors],
    );

    const acceptsDrop = Boolean(onDropItem);
    const acceptsReorder = Boolean(onReorder);

    // Stack is both the scrollable container and dropzone; auto-scroll
    // positioning needs coordinates relative to it.
    const stackRef = useRef<HTMLDivElement>(null);
    useDragAutoScroll(stackRef);

    const { uploadCtrl, handleFileDrop } = useRundownFileDrop({ onDropItem });
    const {
        dropIndex,
        setDropIndex,
        computeDropIndex,
        draggingId,
        draggingHeight,
        startReorderDrag,
        handleReorderDragEnd,
        applyReorderDrop,
    } = useRundownReorder({
        rundownId,
        entries,
        listRef: stackRef,
        onReorder,
        onDropItem,
    });

    const { dragOver, handlers } = useRundownDropzone({
        acceptsDrop,
        acceptsReorder,
        draggingId,
        dropIndex,
        setDropIndex,
        computeDropIndex,
        applyReorderDrop,
        onFileDrop: handleFileDrop,
        onDropItem,
    });

    const dropIndicatorFor = (index: number): 'before' | 'after' | null => {
        if (dropIndex === index) return 'before';
        if (dropIndex === entries.length && index === entries.length - 1)
            return 'after';
        return null;
    };

    // Re-checks against a fresh fetch before opening the confirm dialog;
    // fails closed (doesn't open it) on error or if the type reappeared.
    const confirmOrphaned = (entry: RundownEntry) => {
        void refetchTypes().then(res => {
            if (res.isError) return;
            const fresh = new Set<string>(res.data ?? []);
            if (entry.type && !fresh.has(entry.type)) setPendingDelete(entry);
        });
    };

    return (
        <>
            <Stack
                ref={stackRef}
                spacing={1.5}
                className="no-scrollbar"
                {...handlers}
                onContextMenu={e =>
                    openMenu(e, [
                        {
                            label: t('actions.paste'),
                            disabled: !hasEntry,
                            onClick: () => {
                                const copied = paste();
                                if (copied)
                                    onPaste?.(copied, entries.length - 1);
                            },
                        },
                    ])
                }
                sx={theme => ({
                    position: 'relative',
                    flex: 1,
                    minHeight: 0,
                    // Page disables overflowY at row level; this Stack owns scroll.
                    overflowY: 'auto',
                    // Prevent scroll anchoring: gap-box reflows above the viewport
                    // would nudge scrollTop and oscillate with computeDropIndex.
                    overflowAnchor: 'none',
                    outline: dragOver
                        ? `2px dashed ${alpha(theme.palette.primary.main, 0.6)}`
                        : '2px dashed transparent',
                    outlineOffset: 4,
                    transition: theme.transitions.create('outline-color', {
                        duration: 120,
                    }),
                })}
            >
                {entries.length === 0 && (
                    <Typography
                        variant="body2"
                        sx={{ color: 'text.secondary' }}
                    >
                        {acceptsDrop
                            ? t('rundown.empty.dropOrAdd')
                            : t('rundown.empty.addOne')}
                    </Typography>
                )}

                {entries.map((entry, index) => {
                    const isOrphaned =
                        activeTypes !== null &&
                        Boolean(entry.type) &&
                        !activeTypes.has(entry.type!);
                    const stoppable = Boolean(
                        onStop && entry.type && stoppableTypes.has(entry.type),
                    );

                    return (
                        <RundownListItem
                            key={entry.id}
                            entry={entry}
                            index={index}
                            locked={locked}
                            isOrphaned={isOrphaned}
                            stoppable={stoppable}
                            onEdit={onEdit}
                            onPlay={onPlay}
                            onStop={onStop}
                            onDuplicate={onDuplicate}
                            onPaste={onPaste}
                            onRequestDelete={setPendingDelete}
                            onOrphanDelete={confirmOrphaned}
                            onReorderDragStart={
                                acceptsReorder ? startReorderDrag : undefined
                            }
                            onReorderDragEnd={handleReorderDragEnd}
                            dropIndicator={dropIndicatorFor(index)}
                            gapHeight={draggingHeight}
                            isDragging={draggingId === entry.id}
                        />
                    );
                })}

                <Button
                    variant="contained"
                    fullWidth
                    sx={{ mt: 0.5 }}
                    onClick={() => onAdd()}
                >
                    {t('rundown.addItem')}
                </Button>

                {/* Trailing slack inside the dropzone so the last item ends near
                the top after a full scroll, leaving room to drop more. The
                `%` resolves against the Stack's visible content box (it's the
                overflow:auto element), so this scales with the column.
                The 200px reserve = Add button + gap + roughly one entry, so
                the last real entry is still visible at the bottom of full
                scroll instead of just the Add button. */}
                <Box
                    aria-hidden
                    sx={{
                        flexShrink: 0,
                        height: 'calc(100% - 200px)',
                        minHeight: 120,
                    }}
                />
            </Stack>

            <UploadModal
                state={uploadCtrl.state}
                onClose={uploadCtrl.reset}
                onCancel={uploadCtrl.cancel}
                onConfirm={uploadCtrl.confirm}
            />

            <DeleteEntryModal
                entry={pendingDelete}
                onCancel={() => setPendingDelete(null)}
                onConfirm={entry => {
                    onDelete(entry);
                    setPendingDelete(null);
                }}
            />
        </>
    );
};
