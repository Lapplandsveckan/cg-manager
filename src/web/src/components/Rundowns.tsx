/* eslint-disable max-lines */
import {
    Box,
    Button,
    Card,
    IconButton,
    Modal,
    Stack,
    Tooltip,
    Typography,
    alpha,
} from '@mui/material';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { noTryAsync } from 'no-try';
import { Injections, UI_INJECTION_ZONE } from '../lib/api/inject';
import { SlotErrorBoundary } from './SlotErrorBoundary';
import { useSocket } from '../lib';
import {
    type RundownItemDragPayload,
    hasRundownItemPayload,
    parseRundownItemPayload,
} from '../lib/dragPayload';
import { useDragAutoScroll } from '../lib/hooks/useDragAutoScroll';
import { UploadModal, useFileUpload } from './Upload';
import { useToast } from './ToastProvider';
import { useContextMenu } from './ContextMenuProvider';
import { useEntryClipboard } from './EntryClipboardProvider';

/** Mirrors the server's RundownFileMatchResult — keep them in sync. */
interface RundownFileMatchResult {
    actionId: string;
    payload: RundownItemDragPayload;
    path: string;
    mediaId: string;
    destination: string;
}

function isFileDrag(dt: DataTransfer | null): boolean {
    if (!dt) return false;
    return Array.from(dt.types).includes('Files');
}

export { EditIndicator, LiveIndicator, ModeToggle } from './RundownChrome';
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

                if (Array.isArray(entry)) {
                    const updates = new Map<string, RundownEntry>(
                        entry.map(item => [item.id, item]),
                    );
                    return setEntries(entries =>
                        entries.map(item => updates.get(item.id) ?? item),
                    );
                }

                setEntries(entries =>
                    entries.map(item => (item.id === entry.id ? entry : item)),
                );
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
                    next.splice(
                        Math.max(0, Math.min(next.length, index)),
                        0,
                        entry,
                    );
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

        // Handle multi-client name synchronization: renames from other clients
        // propagate here via rundown-level UPDATE.
        const renameListener = {
            path: 'rundown',
            method: 'UPDATE',

            handler: request => {
                const data = request.getData();
                if (data?.id !== rundown) return;
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
        setEntries(entries.map(v => (v.id === entry.id ? entry : v)));
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
        conn.rawRequest(
            `/api/rundown/${rundown}/order`,
            'ACTION',
            reordered.map(item => item.id),
        );
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
    type?: string;

    onEdit: () => void;
    onPlay: () => void;
    /** When provided, renders a stop button next to play. Only shown when
     *  the action type has a registered stop handler on the server. */
    onStop?: () => void;
    /** Called when the user confirms deletion of an orphaned item. Only
     *  relevant when `disabled` is true; the button is hidden otherwise. */
    onDelete?: () => void;

    active: boolean;
    /** When true (edit mode), clicking the card body opens the editor; in live
     *  mode it fires onPlay. The play button always fires onPlay regardless. */
    locked?: boolean;
    /** Dimmed presentation — the item's action type isn't registered on the
     *  server (typically because the owning plugin is disabled). Edit/Play are
     *  replaced by a delete button so the user can clean up the stale item. */
    disabled?: boolean;
    children: React.ReactNode;

    /** Drag handle wiring — when provided, a grip icon appears on the left
     *  edge and is the only element that initiates a reorder drag. */
    onReorderDragStart?: (
        e: React.DragEvent<HTMLDivElement>,
        height: number,
        grabOffset: number,
    ) => void;
    onReorderDragEnd?: () => void;
    /** When set, an animated gap opens above/below the card to show where the
     *  dragged item will land. */
    dropIndicator?: 'before' | 'after' | null;
    /** Height of the gap in px. Defaults to 64. */
    gapHeight?: number;
    /** Collapses this card (source of the active drag) so the list closes up. */
    isDragging?: boolean;
}

export const RundownEntry: React.FC<RundownEntryProps> = ({
    title,
    type: _type,
    onEdit,
    onPlay,
    onStop,
    onDelete,
    active: _active,
    locked,
    disabled,
    children,
    onReorderDragStart,
    onReorderDragEnd,
    dropIndicator,
    gapHeight = 64,
    isDragging,
}) => {
    const { t } = useTranslation('common');
    const cardClickable = !disabled;
    const supportsReorder = Boolean(onReorderDragStart);
    // Reorder is an editing affordance — only show/allow it when the rundown
    // is locked (edit mode). In show mode the slot is reserved but hidden so
    // the card layout doesn't jump when toggling modes.
    const draggable = supportsReorder && Boolean(locked);
    const cardRef = useRef<HTMLDivElement>(null);

    // Reorder is only active in edit mode (locked). In show mode the slot is
    // reserved but hidden so toggling lock doesn't shift the title.
    return (
        <Box sx={{ position: 'relative' }}>
            <Box
                sx={{
                    height: dropIndicator === 'before' ? gapHeight : 0,
                    flexShrink: 0,
                    overflow: 'hidden',
                }}
            />

            <Stack
                ref={cardRef}
                data-card
                direction="row"
                sx={theme => ({
                    position: 'relative',
                    py: isDragging ? 0 : 2,
                    pr: isDragging ? 0 : 2,
                    // Reserve space so handle visibility toggle doesn't shift layout.
                    pl: isDragging ? 0 : supportsReorder ? '28px' : 2,
                    bgcolor: theme.palette.surface.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 1.5,
                    width: '100%',
                    cursor: cardClickable ? 'pointer' : 'default',
                    opacity: isDragging ? 0 : disabled ? 0.55 : 1,
                    maxHeight: isDragging ? 0 : 2000,
                    overflow: isDragging ? 'hidden' : 'visible',
                    transition: theme.transitions.create(
                        ['border-color', 'background-color', 'opacity'],
                        {
                            duration: 180,
                        },
                    ),
                    '&:hover': cardClickable
                        ? {
                              bgcolor: theme.palette.surface.elevated,
                              borderColor: locked
                                  ? theme.palette.text.secondary
                                  : 'primary.main',
                          }
                        : {
                              bgcolor: theme.palette.surface.elevated,
                          },
                })}
                onClick={e => {
                    if (!cardClickable) return;
                    e.stopPropagation();
                    if (locked) onEdit();
                    else onPlay();
                }}
            >
                {supportsReorder && (
                    <Box
                        className="rundown-drag-handle"
                        draggable={draggable}
                        title={
                            draggable
                                ? t('rundown.entry.dragToReorder')
                                : undefined
                        }
                        onDragStart={e => {
                            const rect =
                                cardRef.current?.getBoundingClientRect();
                            if (cardRef.current && rect) {
                                e.dataTransfer.setDragImage(
                                    cardRef.current,
                                    e.clientX - rect.left,
                                    e.clientY - rect.top,
                                );
                            }
                            e.stopPropagation();
                            onReorderDragStart?.(
                                e,
                                rect?.height ?? 64,
                                e.clientY - (rect?.top ?? e.clientY),
                            );
                        }}
                        onDragEnd={() => onReorderDragEnd?.()}
                        onClick={e => e.stopPropagation()}
                        sx={theme => ({
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
                            transition: theme.transitions.create('color', {
                                duration: 120,
                            }),
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
                        gap={2}
                    >
                        <Typography
                            variant="h4"
                            sx={{
                                minWidth: 0,
                                flexGrow: 1,
                                wordBreak: 'break-word',
                            }}
                        >
                            {title}
                        </Typography>
                        <Stack
                            direction="row"
                            alignItems="center"
                            gap={0.5}
                            sx={{ flexShrink: 0 }}
                            onClick={e => e.stopPropagation()}
                        >
                            {disabled ? (
                                <Tooltip
                                    title={t('rundown.entry.orphanedTooltip')}
                                >
                                    <IconButton
                                        size="small"
                                        onClick={onDelete}
                                        sx={theme => ({
                                            color: theme.palette.error.main,
                                            border: `1px solid ${theme.palette.divider}`,
                                            borderRadius: 1,
                                            '&:hover': {
                                                bgcolor: alpha(
                                                    theme.palette.error.main,
                                                    0.08,
                                                ),
                                                borderColor:
                                                    theme.palette.error.main,
                                            },
                                        })}
                                    >
                                        <DeleteOutlineRoundedIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            ) : (
                                <>
                                    {onStop && (
                                        <Tooltip title={t('actions.stop')}>
                                            <IconButton
                                                size="small"
                                                onClick={onStop}
                                                sx={{ color: 'error.main' }}
                                            >
                                                <StopRoundedIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    )}
                                    <Tooltip title={t('actions.play')}>
                                        <IconButton
                                            size="small"
                                            onClick={onPlay}
                                            sx={{ color: 'primary.main' }}
                                        >
                                            <PlayArrowRoundedIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </>
                            )}
                        </Stack>
                    </Stack>
                    {children && (
                        <Stack spacing={1.5} direction="column">
                            {children}
                        </Stack>
                    )}
                </Stack>
            </Stack>

            <Box
                sx={{
                    height: dropIndicator === 'after' ? gapHeight : 0,
                    flexShrink: 0,
                    overflow: 'hidden',
                }}
            />
        </Box>
    );
};

interface RundownsProps {
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
     *  should be appended. */
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

function hasReorderPayload(dt: DataTransfer | null): boolean {
    if (!dt) return false;
    return Array.from(dt.types).includes(RUNDOWN_REORDER_MIME);
}

export const Rundowns: React.FC<RundownsProps> = ({
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
    const conn = useSocket();
    const notify = useToast();
    const { openMenu, openSurfaceMenu } = useContextMenu();
    const { copy, paste, hasEntry } = useEntryClipboard();
    const [pendingDelete, setPendingDelete] = useState<RundownEntry | null>(
        null,
    );
    const [dragOver, setDragOver] = useState(false);
    const [reorderDraggingId, setReorderDraggingId] = useState<string | null>(
        null,
    );
    const [draggingHeight, setDraggingHeight] = useState(0);
    const [dropIndex, setDropIndex] = useState<number | null>(null);
    // Written synchronously so computeDropIndex sees the correct offset on the
    // first dragover without waiting for a re-render.
    const grabOffsetRef = useRef(0);
    // Mirrored each render so dragend reads the latest value without stale closures.
    const dropIndexRef = useRef<number | null>(null);
    dropIndexRef.current = dropIndex;
    // Marked synchronously by applyReorderDrop so dragend can skip the
    // outside-container path without relying on render timing.
    const didDropInsideRef = useRef(false);

    const [activeTypes, setActiveTypes] = useState<Set<string> | null>(null);
    const [stoppableTypes, setStoppableTypes] = useState<Set<string>>(
        new Set(),
    );
    const refetchTypes = useCallback(() => {
        conn.rawRequest('/api/rundown/types', 'GET', {})
            .then(res => setActiveTypes(new Set(res.data ?? [])))
            .catch(() => {
                /* keep previous on error */
            });
        conn.rawRequest('/api/rundown/actions', 'GET', {})
            .then(res => {
                const descriptors = (res.data ?? []) as {
                    id: string;
                    hasStop: boolean;
                }[];
                setStoppableTypes(
                    new Set(descriptors.filter(d => d.hasStop).map(d => d.id)),
                );
            })
            .catch(() => {
                /* keep previous on error */
            });
    }, [conn]);

    // Fetch on mount and re-fetch whenever CasparCG restarts (plugins
    // re-register their actions after each restart, so the type list can
    // change without a page reload).
    useEffect(() => {
        refetchTypes();
    }, [refetchTypes]);

    useEffect(() => {
        const listener = {
            path: 'caspar/status',
            method: 'ACTION',
            handler: () => refetchTypes(),
        };
        conn.routes.register(listener);
        return () => conn.routes.unregister(listener);
    }, [conn, refetchTypes]);

    const acceptsDrop = Boolean(onDropItem);
    const acceptsReorder = Boolean(onReorder);

    // Stack is both the scrollable container and dropzone; auto-scroll
    // positioning needs coordinates relative to it.
    const stackRef = useRef<HTMLDivElement>(null);
    useDragAutoScroll(stackRef);

    // Stash per-file match results across the async match/upload phases.
    // useFileUpload binds createUpload at hook construction, so refs hold state.
    const fileMatchesRef = useRef<Map<File, RundownFileMatchResult>>(new Map());
    const fileBaseIndexRef = useRef<number | undefined>(undefined);
    const onDropItemRef = useRef(onDropItem);
    onDropItemRef.current = onDropItem;
    const uploadCtrl = useFileUpload({
        createUpload: async file => {
            const match = fileMatchesRef.current.get(file);
            if (!match) throw new Error('No match stashed for file');
            return conn.caspar.uploadMedia(match.path, file);
        },
    });

    // `completed` is set alongside the terminal phase, so it's current
    // when this effect runs.
    const { phase: uploadPhase } = uploadCtrl.state;
    useEffect(() => {
        if (uploadPhase !== 'done' && uploadPhase !== 'error') return;

        let offset = 0;
        for (const result of uploadCtrl.state.completed) {
            if (result.error) continue;
            const match = fileMatchesRef.current.get(result.file);
            if (!match) continue;
            const index =
                fileBaseIndexRef.current !== undefined
                    ? fileBaseIndexRef.current + offset++
                    : undefined;
            onDropItemRef.current?.(match.payload, index);
        }
        fileMatchesRef.current.clear();
        fileBaseIndexRef.current = undefined;
        // Auto-dismiss on success so operator sees items in rundown.
        // Errors stay open for reading failure messages.
        if (uploadPhase === 'done') uploadCtrl.reset();
    }, [uploadPhase]);

    const handleFileDrop = async (
        files: File[],
        baseIndex: number | undefined,
    ) => {
        // Run matches in parallel; they don't depend on each other.
        const matchResults = await Promise.all(
            files.map(async file => {
                const [err, res] = await noTryAsync(() =>
                    conn.rawRequest('/api/rundown/actions/match', 'ACTION', {
                        name: file.name,
                        type: file.type,
                        size: file.size,
                    }),
                );
                if (err)
                    return { file, matches: [] as RundownFileMatchResult[] };
                return {
                    file,
                    matches: (res?.data as RundownFileMatchResult[]) ?? [],
                };
            }),
        );

        const accepted: File[] = [];
        const unmatched: string[] = [];
        for (const { file, matches } of matchResults) {
            if (!matches.length) {
                unmatched.push(file.name);
                continue;
            }
            // v1: first match only. Multi-match picker is a follow-up.
            fileMatchesRef.current.set(file, matches[0]);
            accepted.push(file);
        }

        if (unmatched.length)
            notify(
                t('rundown.drop.noAction', { count: unmatched.length }),
                'warning',
            );

        if (!accepted.length) return;

        fileBaseIndexRef.current = baseIndex;
        uploadCtrl.start(accepted);
        // Auto-confirm after start() to skip the review phase.
        // Explicit drop signals intent without needing confirmation.
        uploadCtrl.confirm();
    };

    const clearReorderState = useCallback(() => {
        setDropIndex(null);
        setReorderDraggingId(null);
        setDraggingHeight(0);
        grabOffsetRef.current = 0;
    }, []);

    // Counts cards above the drag reference point using natural card heights, not
    // live getBoundingClientRect().bottom — those are shifted by the open gap spacer
    // and produce wrong results. [data-card] is a sibling of gap boxes so heights
    // are gap-independent. Reads only refs so useCallback deps stay empty.
    const computeDropIndex = useCallback((clientY: number): number => {
        const refY = clientY - grabOffsetRef.current;
        const el = stackRef.current;
        // Subtract scrollTop so listTop tracks content origin as the user scrolls.
        const listTop =
            (el?.getBoundingClientRect().top ?? 0) - (el?.scrollTop ?? 0);
        const cards = Array.from(
            el?.querySelectorAll('[data-card]') ?? [],
        ) as HTMLElement[];
        const spacing = 12; // MUI Stack spacing={1.5} = 1.5 * 8px
        let y = listTop;
        let idx = 0;
        for (let i = 0; i < cards.length; i++) {
            if (i > 0) y += spacing;
            y += cards[i].getBoundingClientRect().height;
            if (y <= refY) idx++;
            else break;
        }
        return idx;
    }, []);

    // Track cursor Y globally so the gap stays visible when dragging outside the container.
    useEffect(() => {
        if (!reorderDraggingId) return;
        const handler = (e: DragEvent) => {
            e.preventDefault();
            setDropIndex(computeDropIndex(e.clientY));
        };
        document.addEventListener('dragover', handler);
        return () => document.removeEventListener('dragover', handler);
    }, [reorderDraggingId, computeDropIndex]);

    const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        const isReorder = hasReorderPayload(e.dataTransfer);
        const isCreate =
            acceptsDrop &&
            (hasRundownItemPayload(e.dataTransfer) ||
                isFileDrag(e.dataTransfer));

        if (isReorder && acceptsReorder) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            // reorderDraggingId is set one RAF after dragstart so the drag image
            // is captured from the full-height card before React collapses it.
            if (reorderDraggingId) setDropIndex(computeDropIndex(e.clientY));
            return;
        }
        if (isCreate) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            if (!dragOver) setDragOver(true);
            setDropIndex(computeDropIndex(e.clientY));
        }
    };

    const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        // Only flip off when the drag actually leaves the wrapper, not when
        // moving between nested children.
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragOver(false);
        if (!reorderDraggingId) {
            setDropIndex(null);
            return;
        }
        // Cursor left the container during a reorder drag. Snap to the nearest
        // edge immediately (0 if above, entries.length if below/side) so the gap
        // doesn't vanish while the document handler takes over continuous tracking.
        setDropIndex(computeDropIndex(e.clientY));
    };

    const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
        if (hasReorderPayload(e.dataTransfer)) {
            applyReorderDrop(e);
            return;
        }
        if (!acceptsDrop) return;

        if (isFileDrag(e.dataTransfer)) {
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files);
            const index = dropIndex ?? undefined;
            setDragOver(false);
            setDropIndex(null);
            if (files.length) void handleFileDrop(files, index);
            return;
        }

        const payload = parseRundownItemPayload(e.dataTransfer);
        setDragOver(false);
        if (!payload) {
            setDropIndex(null);
            return;
        }
        e.preventDefault();

        const index = dropIndex ?? undefined;
        setDropIndex(null);
        onDropItem?.(payload, index);
    };

    const applyReorderDrop = (e: React.DragEvent<HTMLDivElement>) => {
        const fromId = e.dataTransfer.getData(RUNDOWN_REORDER_MIME);
        if (!fromId || dropIndex === null || !onReorder) {
            clearReorderState();
            return;
        }
        e.preventDefault();

        const fromIndex = entries.findIndex(en => en.id === fromId);
        if (fromIndex < 0) {
            clearReorderState();
            return;
        }

        // Mark before clearing so dragend (fired after drop) skips the outside-container path.
        didDropInsideRef.current = true;
        const toIndex = fromIndex < dropIndex ? dropIndex - 1 : dropIndex;
        clearReorderState();

        if (fromIndex === toIndex) return;

        const next = [...entries];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        onReorder(next.map(en => en.id));
    };

    const onReorderDragEnd = useCallback(() => {
        if (!didDropInsideRef.current) {
            const idx = dropIndexRef.current;
            if (idx !== null && reorderDraggingId && onReorder) {
                const fromIndex = entries.findIndex(
                    en => en.id === reorderDraggingId,
                );
                if (fromIndex >= 0) {
                    const toIndex = fromIndex < idx ? idx - 1 : idx;
                    if (fromIndex !== toIndex) {
                        const next = [...entries];
                        const [moved] = next.splice(fromIndex, 1);
                        next.splice(toIndex, 0, moved);
                        onReorder(next.map(en => en.id));
                    }
                }
            }
        }
        didDropInsideRef.current = false;
        clearReorderState();
    }, [reorderDraggingId, entries, onReorder, clearReorderState]);

    return (
        <>
            <Stack
                ref={stackRef}
                spacing={1.5}
                className="no-scrollbar"
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
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
                    return (
                        <Box
                            key={entry.id}
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
                                    [
                                        {
                                            label: t('actions.edit'),
                                            icon: (
                                                <EditOutlinedIcon fontSize="small" />
                                            ),
                                            onClick: () => onEdit(entry),
                                        },
                                        {
                                            label: t('actions.play'),
                                            icon: (
                                                <PlayArrowRoundedIcon fontSize="small" />
                                            ),
                                            disabled: isOrphaned,
                                            onClick: () => onPlay(entry),
                                        },
                                        {
                                            label: t('actions.duplicate'),
                                            icon: (
                                                <ContentCopyRoundedIcon fontSize="small" />
                                            ),
                                            divider: true,
                                            onClick: () =>
                                                onDuplicate?.(entry, index),
                                        },
                                        {
                                            label: t('actions.copy'),
                                            onClick: () => copy(entry),
                                        },
                                        {
                                            label: t('actions.paste'),
                                            disabled: !hasEntry,
                                            onClick: () => {
                                                const copied = paste();
                                                if (copied)
                                                    onPaste?.(copied, index);
                                            },
                                        },
                                        {
                                            label: t('actions.delete'),
                                            icon: (
                                                <DeleteOutlineRoundedIcon fontSize="small" />
                                            ),
                                            danger: true,
                                            divider: true,
                                            onClick: () =>
                                                setPendingDelete(entry),
                                        },
                                    ],
                                )
                            }
                        >
                            <SlotErrorBoundary
                                label={`rundown-entry:${entry.id}`}
                                resetKeys={[entry.id]}
                            >
                                <RundownEntry
                                    title={entry.title}
                                    type={entry.type}
                                    active={false}
                                    locked={locked}
                                    disabled={isOrphaned}
                                    onEdit={() => onEdit(entry)}
                                    onPlay={() => onPlay(entry)}
                                    onStop={
                                        onStop &&
                                        entry.type &&
                                        stoppableTypes.has(entry.type)
                                            ? () => onStop(entry)
                                            : undefined
                                    }
                                    onDelete={
                                        isOrphaned
                                            ? () => {
                                                  conn.rawRequest(
                                                      '/api/rundown/types',
                                                      'GET',
                                                      {},
                                                  )
                                                      .then(res => {
                                                          const fresh =
                                                              new Set<string>(
                                                                  res.data ??
                                                                      [],
                                                              );
                                                          setActiveTypes(fresh);
                                                          if (
                                                              entry.type &&
                                                              !fresh.has(
                                                                  entry.type,
                                                              )
                                                          ) {
                                                              setPendingDelete(
                                                                  entry,
                                                              );
                                                          }
                                                      })
                                                      .catch(() => {
                                                          /* fail closed — don't open dialog */
                                                      });
                                              }
                                            : undefined
                                    }
                                    onReorderDragStart={
                                        acceptsReorder
                                            ? (e, height, offset) => {
                                                  e.dataTransfer.setData(
                                                      RUNDOWN_REORDER_MIME,
                                                      entry.id,
                                                  );
                                                  e.dataTransfer.effectAllowed =
                                                      'move';
                                                  setDraggingHeight(height);
                                                  grabOffsetRef.current =
                                                      offset;
                                                  // Defer so the drag image is captured before the card collapses.
                                                  requestAnimationFrame(() =>
                                                      setReorderDraggingId(
                                                          entry.id,
                                                      ),
                                                  );
                                              }
                                            : undefined
                                    }
                                    onReorderDragEnd={onReorderDragEnd}
                                    dropIndicator={
                                        dropIndex === index
                                            ? 'before'
                                            : dropIndex === entries.length &&
                                                index === entries.length - 1
                                              ? 'after'
                                              : null
                                    }
                                    gapHeight={draggingHeight || 64}
                                    isDragging={reorderDraggingId === entry.id}
                                >
                                    <Injections
                                        zone={`${UI_INJECTION_ZONE.RUNDOWN_ITEM}.${entry.type}`}
                                        props={{ entry }}
                                    />
                                </RundownEntry>
                            </SlotErrorBoundary>
                        </Box>
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

            <Modal
                open={pendingDelete !== null}
                onClose={() => setPendingDelete(null)}
            >
                <Stack
                    justifyContent="center"
                    alignItems="center"
                    sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                    }}
                >
                    <Card
                        sx={theme => ({
                            p: 3,
                            width: 460,
                            bgcolor: theme.palette.surface.elevated,
                            border: `1px solid ${theme.palette.divider}`,
                        })}
                    >
                        <Stack spacing={2}>
                            <Stack
                                direction="row"
                                alignItems="center"
                                gap={1.5}
                            >
                                <WarningAmberRoundedIcon
                                    sx={theme => ({
                                        color: theme.palette.error.light,
                                    })}
                                />
                                <Typography variant="h3">
                                    {t('rundown.deleteEntryDialog.title')}
                                </Typography>
                            </Stack>
                            <Typography
                                variant="body1"
                                sx={{ color: 'text.secondary' }}
                            >
                                {t('rundown.deleteEntryDialog.body', {
                                    title: pendingDelete?.title ?? '',
                                    type: pendingDelete?.type ?? '',
                                })}
                            </Typography>
                            <Stack
                                direction="row"
                                justifyContent="flex-end"
                                gap={1}
                            >
                                <Button
                                    color="inherit"
                                    onClick={() => setPendingDelete(null)}
                                >
                                    {t('actions.cancel')}
                                </Button>
                                <Button
                                    variant="contained"
                                    color="error"
                                    onClick={() => {
                                        if (pendingDelete) {
                                            onDelete(pendingDelete);
                                            setPendingDelete(null);
                                        }
                                    }}
                                >
                                    {t('actions.delete')}
                                </Button>
                            </Stack>
                        </Stack>
                    </Card>
                </Stack>
            </Modal>
        </>
    );
};
