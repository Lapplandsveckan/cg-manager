/* eslint-disable max-lines */
import {Injections, UI_INJECTION_ZONE} from '../lib/api/inject';
import {Box, Button, IconButton, Stack, Tooltip, Typography, alpha} from '@mui/material';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import React, {useEffect, useRef, useState} from 'react';
import {useSocket} from '../lib';
import {RundownItemDragPayload, hasRundownItemPayload, parseRundownItemPayload} from '../lib/dragPayload';

export {LiveIndicator, LockToggle} from './RundownChrome';
export const RUNDOWN_REORDER_MIME = 'application/x-cg-rundown-reorder';

export interface RundownEntry {
    id: string;
    title: string;
    data: any;

    type?: string;
}

export function useRundownEntries(rundown: string) {
    const conn = useSocket();
    const [entries, setEntries] = useState<RundownEntry[]>([]);
    const [name, setName] = useState<string>('');

    useEffect(() => {
        if (!rundown) {
            setName('');
            return;
        }
        conn.rawRequest(`/api/rundown/${rundown}`, 'GET', {}).then(res => {
            setEntries(res.data?.items ?? []);
            setName(res.data?.name ?? '');
        });

        const updateListener = {
            path: 'rundown/entry',
            method: 'UPDATE',

            handler: request => {
                const data = request.getData();
                const { id, entry } = data;
                if (id !== rundown) return;

                if (Array.isArray(entry)) { // Batch update, and reordering of the selected items
                    const updates = new Map<string, RundownEntry>(entry.map(item => [item.id, item]));
                    return setEntries(entries => entries.map(item => updates.get(item.id) ?? item));
                }

                setEntries(entries => entries.map(item => item.id === entry.id ? entry : item));
            },
        };

        const deleteListener = {
            path: 'rundown/entry',
            method: 'DELETE',

            handler: request => {
                const data = request.getData();
                const { id, entry } = data;
                if (id !== rundown) return;

                setEntries(entries => entries.filter(v => v.id !== entry));
            },
        };

        const createListener = {
            path: 'rundown/entry',
            method: 'CREATE',

            handler: request => {
                const data = request.getData();
                const { id, entry, index } = data;
                if (id !== rundown) return;

                setEntries(entries => {
                    if (typeof index !== 'number') return [...entries, entry];
                    const next = [...entries];
                    next.splice(Math.max(0, Math.min(next.length, index)), 0, entry);
                    return next;
                });
            },
        };

        const orderListener = {
            path: 'rundown/order',
            method: 'ACTION',

            handler: request => {
                const data = request.getData();
                const { id, order } = data as { id: string; order: string[] };
                if (id !== rundown) return;
                if (!Array.isArray(order)) return;

                setEntries(entries => {
                    const byId = new Map(entries.map(item => [item.id, item]));
                    const reordered: RundownEntry[] = [];
                    for (const oid of order) {
                        const item = byId.get(oid);
                        if (!item) continue;
                        reordered.push(item);
                        byId.delete(oid);
                    }
                    for (const item of byId.values()) reordered.push(item);
                    return reordered;
                });
            },
        };

        // Mirror name changes broadcast on the rundown-level UPDATE so the
        // displayed title stays in sync with renames from other clients.
        const renameListener = {
            path: 'rundown',
            method: 'UPDATE',

            handler: request => {
                const data = request.getData();
                if (!data || data.id !== rundown) return;
                if (typeof data.name === 'string') setName(data.name);
            },
        };

        conn.routes.register(updateListener);
        conn.routes.register(deleteListener);
        conn.routes.register(createListener);
        conn.routes.register(orderListener);
        conn.routes.register(renameListener);

        return () => {
            conn.routes.unregister(updateListener);
            conn.routes.unregister(deleteListener);
            conn.routes.unregister(createListener);
            conn.routes.unregister(orderListener);
            conn.routes.unregister(renameListener);
        };
    }, [rundown]);

    const createEntry = (entry: RundownEntry, index?: number) => {
        const payload = typeof index === 'number' ? { entry, index } : entry;
        conn.rawRequest(`/api/rundown/${rundown}/entry`, 'CREATE', payload);
        setEntries(prev => {
            if (typeof index !== 'number') return [...prev, entry];
            const next = [...prev];
            next.splice(Math.max(0, Math.min(next.length, index)), 0, entry);
            return next;
        });
    };

    const updateEntry = (entry: RundownEntry) => {
        conn.rawRequest(`/api/rundown/${rundown}/entry`, 'UPDATE', entry);
        setEntries(entries.map(v => v.id === entry.id ? entry : v));
    };

    const deleteEntry = (entry: RundownEntry) => {
        conn.rawRequest(`/api/rundown/${rundown}/entry`, 'DELETE', entry.id);
        setEntries(entries.filter(v => v.id !== entry.id));
    };

    const reorderEntries = (orderedIds: string[]) => {
        const byId = new Map(entries.map(item => [item.id, item]));
        const reordered: RundownEntry[] = [];
        for (const id of orderedIds) {
            const item = byId.get(id);
            if (!item) continue;
            reordered.push(item);
            byId.delete(id);
        }
        for (const item of byId.values()) reordered.push(item);

        setEntries(reordered);
        conn.rawRequest(`/api/rundown/${rundown}/order`, 'ACTION', reordered.map(item => item.id));
    };

    return {
        name,
        entries,

        updateEntry,
        deleteEntry,
        createEntry,
        reorderEntries,
    };
}

interface RundownEntryProps {
    title: string;
    type: string;

    onEdit: () => void;
    onPlay: () => void;

    active: boolean;
    /** When true, clicking the card body does nothing; only the explicit play button fires onPlay. */
    locked?: boolean;
    children: React.ReactNode;

    /** Drag handle wiring — when provided, a grip icon appears on the left
     *  edge and is the only element that initiates a reorder drag. */
    onReorderDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
    onReorderDragEnd?: () => void;
    /** When set, a horizontal copper line is rendered above/below the card
     *  to indicate where the dragged item will land. */
    dropIndicator?: 'before' | 'after' | null;
    /** Dimmed appearance while this card is the source of the active drag. */
    isDragging?: boolean;
}

export const RundownEntry: React.FC<RundownEntryProps> = ({
    title,
    type,
    onEdit,
    onPlay,
    active,
    locked,
    children,
    onReorderDragStart,
    onReorderDragEnd,
    dropIndicator,
    isDragging,
}) => {
    const cardClickable = !locked;
    const supportsReorder = Boolean(onReorderDragStart);
    // Reorder is an editing affordance — only show/allow it when the rundown
    // is locked (edit mode). In show mode the slot is reserved but hidden so
    // the card layout doesn't jump when toggling modes.
    const draggable = supportsReorder && Boolean(locked);
    const cardRef = useRef<HTMLDivElement>(null);

    return (
        <Box sx={{ position: 'relative' }}>
            {dropIndicator === 'before' && <DropIndicator position="top" />}

            <Stack
                ref={cardRef}
                direction="row"
                sx={(theme) => ({
                    position: 'relative',
                    py: 2,
                    pr: 2,
                    // Reserve constant horizontal space for the handle when the
                    // card supports reordering, so toggling lock doesn't shift
                    // the title.
                    pl: supportsReorder ? '28px' : 2,
                    bgcolor: theme.palette.surface.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 1.5,
                    width: '100%',
                    cursor: cardClickable ? 'pointer' : 'default',
                    opacity: isDragging ? 0.4 : 1,
                    transition: theme.transitions.create(
                        ['border-color', 'background-color', 'opacity'],
                        { duration: 120 },
                    ),
                    '&:hover': cardClickable ? {
                        bgcolor: theme.palette.surface.elevated,
                        borderColor: 'primary.main',
                    } : {
                        bgcolor: theme.palette.surface.elevated,
                    },
                })}

                onClick={e => {
                    if (!cardClickable) return;
                    e.stopPropagation();
                    onPlay();
                }}
            >
                {supportsReorder && (
                    <Box
                        className="rundown-drag-handle"
                        draggable={draggable}
                        title={draggable ? 'Drag to reorder' : undefined}
                        onDragStart={(e) => {
                            if (cardRef.current) {
                                const rect = cardRef.current.getBoundingClientRect();
                                e.dataTransfer.setDragImage(
                                    cardRef.current,
                                    e.clientX - rect.left,
                                    e.clientY - rect.top,
                                );
                            }
                            e.stopPropagation();
                            onReorderDragStart?.(e);
                        }}
                        onDragEnd={() => onReorderDragEnd?.()}
                        onClick={e => e.stopPropagation()}
                        sx={(theme) => ({
                            position: 'absolute',
                            left: 2,
                            top: 0,
                            bottom: 0,
                            width: 20,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: draggable ? 'grab' : 'default',
                            visibility: draggable ? 'visible' : 'hidden',
                            color: theme.palette.text.secondary,
                            transition: theme.transitions.create('color', { duration: 120 }),
                            '&:active': { cursor: 'grabbing' },
                            '&:hover': { color: theme.palette.text.primary },
                        })}
                    >
                        <DragIndicatorRoundedIcon sx={{ fontSize: 16 }} />
                    </Box>
                )}

                <Stack spacing={1.5} sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        gap={1}
                    >
                        <Typography variant="h4" sx={{ minWidth: 0, wordBreak: 'break-word' }}>
                            {title}
                        </Typography>
                        <Stack
                            direction="row"
                            alignItems="center"
                            gap={0.5}
                            sx={{ flexShrink: 0 }}
                            onClick={e => e.stopPropagation()}
                        >
                            <Tooltip title="Edit">
                                <IconButton size="small" onClick={onEdit} sx={{ color: 'text.secondary' }}>
                                    <EditOutlinedIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title={locked ? 'Play (rundown is locked — items only fire from this button)' : 'Play'}>
                                <IconButton
                                    size="small"
                                    onClick={onPlay}
                                    sx={{ color: 'primary.main' }}
                                >
                                    <PlayArrowRoundedIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Stack>
                    </Stack>
                    {children && (
                        <Stack
                            spacing={1.5}
                            direction="column"
                        >
                            {children}
                        </Stack>
                    )}
                </Stack>
            </Stack>

            {dropIndicator === 'after' && <DropIndicator position="bottom" />}
        </Box>
    );
};

const DropIndicator: React.FC<{ position: 'top' | 'bottom' }> = ({ position }) => (
    <Box
        sx={(theme) => ({
            position: 'absolute',
            left: 0,
            right: 0,
            [position]: -8,
            height: 2,
            bgcolor: theme.palette.primary.main,
            borderRadius: 1,
            pointerEvents: 'none',
            boxShadow: `0 0 6px ${alpha(theme.palette.primary.main, 0.6)}`,
        })}
    />
);

interface RundownsProps {
    entries: RundownEntry[];

    onEdit: (entry: RundownEntry) => void;
    onPlay: (entry: RundownEntry) => void;
    onAdd: () => void;

    /** Called when a drag payload is dropped onto the list. The handler should
     *  produce a new RundownEntry from the payload (e.g. open the editor modal
     *  with the pre-filled fields). When the user hovered over a specific item
     *  during the drag, `index` is the position in the list where the entry
     *  should be inserted; when omitted (dropped on empty space), the entry
     *  should be appended. */
    onDropItem?: (payload: RundownItemDragPayload, index?: number) => void;
    /** Called when items have been reordered via drag. Receives the new
     *  ordered list of item ids. */
    onReorder?: (orderedIds: string[]) => void;

    locked?: boolean;
}

function hasReorderPayload(dt: DataTransfer | null): boolean {
    if (!dt) return false;
    return Array.from(dt.types).includes(RUNDOWN_REORDER_MIME);
}

export const Rundowns: React.FC<RundownsProps> = ({entries, onEdit, onPlay, onAdd, onDropItem, onReorder, locked}) => {
    const [dragOver, setDragOver] = useState(false);
    const [reorderDraggingId, setReorderDraggingId] = useState<string | null>(null);
    const [insertion, setInsertion] = useState<{ id: string; position: 'before' | 'after' } | null>(null);

    const acceptsDrop = Boolean(onDropItem);
    const acceptsReorder = Boolean(onReorder);

    const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        if (acceptsDrop && hasRundownItemPayload(e.dataTransfer)) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            if (!dragOver) setDragOver(true);
            return;
        }
        // Reorder over-empty-area is handled per-item via onItemDragOver.
    };
    const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        // Only flip off when the drag actually leaves the wrapper, not when
        // moving between nested children. Without this the insertion line
        // would stay drawn in one list after the cursor moved to another
        // (e.g. Rundown ↔ Quick Actions) since per-item dragover only fires
        // when entering items, not when leaving the whole column.
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragOver(false);
        setInsertion(null);
    };
    const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
        if (hasReorderPayload(e.dataTransfer)) {
            applyReorderDrop(e);
            return;
        }
        if (!acceptsDrop) return;
        const payload = parseRundownItemPayload(e.dataTransfer);
        setDragOver(false);
        if (!payload) {
            setInsertion(null);
            return;
        }
        e.preventDefault();

        // If the user hovered an item during the drag, insert at that
        // position; otherwise (drop on the empty area below) append.
        let index: number | undefined;
        if (insertion) {
            const itemIndex = entries.findIndex(en => en.id === insertion.id);
            if (itemIndex >= 0) 
                index = insertion.position === 'before' ? itemIndex : itemIndex + 1;
            
        }
        setInsertion(null);
        onDropItem?.(payload, index);
    };

    const onItemDragOver = (e: React.DragEvent<HTMLDivElement>, id: string) => {
        const isReorder = hasReorderPayload(e.dataTransfer);
        const isCreate = !isReorder && acceptsDrop && hasRundownItemPayload(e.dataTransfer);

        if (isReorder && acceptsReorder) {
            if (reorderDraggingId === id) {
                // Hovering the source itself — clear any indicator
                setInsertion(prev => (prev ? null : prev));
                return;
            }
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const rect = e.currentTarget.getBoundingClientRect();
            const position: 'before' | 'after' =
                e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
            setInsertion(prev =>
                prev?.id === id && prev?.position === position ? prev : { id, position },
            );
            return;
        }

        if (isCreate) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            const rect = e.currentTarget.getBoundingClientRect();
            const position: 'before' | 'after' =
                e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
            setInsertion(prev =>
                prev?.id === id && prev?.position === position ? prev : { id, position },
            );
        }
    };

    const applyReorderDrop = (e: React.DragEvent<HTMLDivElement>) => {
        const fromId = e.dataTransfer.getData(RUNDOWN_REORDER_MIME);
        if (!fromId || !insertion || !onReorder) {
            setInsertion(null);
            setReorderDraggingId(null);
            return;
        }
        e.preventDefault();

        const fromIndex = entries.findIndex(en => en.id === fromId);
        if (fromIndex < 0) {
            setInsertion(null);
            setReorderDraggingId(null);
            return;
        }

        let toIndex = entries.findIndex(en => en.id === insertion.id);
        if (insertion.position === 'after') toIndex++;
        if (fromIndex < toIndex) toIndex--;

        setInsertion(null);
        setReorderDraggingId(null);

        if (fromIndex === toIndex) return;

        const next = [...entries];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);

        onReorder(next.map(en => en.id));
    };

    return (
        <Stack
            spacing={1.5}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            sx={(theme) => ({
                position: 'relative',
                flex: 1,
                minHeight: 0,
                // Each column scrolls on its own — the page has overflowY
                // disabled at the row level so this Stack owns the scroll.
                overflowY: 'auto',
                borderRadius: 1.5,
                outline: dragOver
                    ? `2px dashed ${alpha(theme.palette.primary.main, 0.6)}`
                    : '2px dashed transparent',
                outlineOffset: 4,
                transition: theme.transitions.create('outline-color', { duration: 120 }),
            })}
        >
            {entries.length === 0 && (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {acceptsDrop
                        ? 'No items yet. Drop something from the bottom panel, or add one below.'
                        : 'No items yet. Add one below to get started.'}
                </Typography>
            )}

            {entries.map(entry => (
                <Box
                    key={entry.id}
                    onDragOver={(e) => onItemDragOver(e, entry.id)}
                >
                    <RundownEntry
                        title={entry.title}
                        type={entry.type}
                        active={false}
                        locked={locked}
                        onEdit={() => onEdit(entry)}
                        onPlay={() => onPlay(entry)}
                        onReorderDragStart={
                            acceptsReorder
                                ? (e) => {
                                    e.dataTransfer.setData(RUNDOWN_REORDER_MIME, entry.id);
                                    e.dataTransfer.effectAllowed = 'move';
                                    setReorderDraggingId(entry.id);
                                }
                                : undefined
                        }
                        onReorderDragEnd={() => {
                            setReorderDraggingId(null);
                            setInsertion(null);
                        }}
                        dropIndicator={
                            insertion && insertion.id === entry.id ? insertion.position : null
                        }
                        isDragging={reorderDraggingId === entry.id}
                    >
                        <Injections zone={`${UI_INJECTION_ZONE.RUNDOWN_ITEM}.${entry.type}`} props={{entry}} />
                    </RundownEntry>
                </Box>
            ))}

            <Button
                variant="contained"
                fullWidth
                sx={{ mt: 0.5 }}
                onClick={() => onAdd()}
            >
                Add item
            </Button>

            {/* Trailing slack inside the dropzone so the last item ends near
                the top after a full scroll, leaving room to drop more. The
                `%` resolves against the Stack's visible content box (it's the
                overflow:auto element), so this scales with the column. */}
            <Box
                aria-hidden
                sx={{
                    flexShrink: 0,
                    height: 'calc(100% - 80px)',
                    minHeight: 80,
                }}
            />
        </Stack>
    );
};

