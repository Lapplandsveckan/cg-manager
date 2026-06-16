import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { Box, Stack, Tooltip, Typography } from '@mui/material';
import { useRouter } from 'next/router';
import { noTry } from 'no-try';
import { getStorageItem, setStorageItem } from '../../../lib/storage';
import { useDragAutoScroll } from '../../../lib/hooks/useDragAutoScroll';
import { DefaultContentLayout } from '../../../components/DefaultContentLayout';
import { usePlayEntry } from '../../../lib/hooks/usePlayEntry';
import { Injections, UI_INJECTION_ZONE } from '../../../lib/api/inject';
import {
    EditIndicator,
    LiveIndicator,
    LockToggle,
    type RundownEntry,
    Rundowns,
    useRundownEntries,
} from '../../../components/Rundowns';
import { RundownModals } from '../../../components/RundownModals';
import { QuickActions } from '../../../components/QuickActions';
import { BottomPanel } from '../../../components/BottomPanel';
import { RundownPreview } from '../../../components/RundownPreview';
import { type RundownItemDragPayload } from '../../../lib/dragPayload';
import { RundownLiveProvider } from '../../../hooks/useRundownLive';

// Default sizes target ~80% of the previous defaults (560/560/480) so the
// three columns fit comfortably side-by-side on a standard 1440px viewport
// without scrolling. Bounds let you squeeze further when space is tight and
// give each column a hard ceiling so one doesn't eat the row.
const COLUMN_DEFAULTS = [450, 450, 380];
const MIN_COLUMN_WIDTH = 220;
const MAX_COLUMN_WIDTH = 700;
const STORAGE_KEY = 'play-column-widths';

function clampWidth(w: number): number {
    return Math.max(
        MIN_COLUMN_WIDTH,
        Math.min(MAX_COLUMN_WIDTH, Math.round(w)),
    );
}

function loadStoredWidths(): number[] | null {
    const raw = getStorageItem(STORAGE_KEY);
    if (!raw) return null;
    const [err, parsed] = noTry(() => JSON.parse(raw));
    if (
        err ||
        !Array.isArray(parsed) ||
        parsed.length !== COLUMN_DEFAULTS.length
    )
        return null;
    return parsed.map((v: unknown) =>
        clampWidth(Number(v) || MIN_COLUMN_WIDTH),
    );
}

function useColumnWidths(): [number[], (index: number, width: number) => void] {
    const [widths, setWidths] = useState<number[]>(COLUMN_DEFAULTS);

    useEffect(() => {
        const stored = loadStoredWidths();
        if (stored) setWidths(stored);
    }, []);

    const setWidth = (index: number, width: number) => {
        setWidths(prev => {
            const next = prev.map((v, i) =>
                i === index ? clampWidth(width) : v,
            );
            setStorageItem(STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    };

    return [widths, setWidth];
}

interface ResizeHandleProps {
    startWidth: number;
    minWidth: number;
    maxWidth: number;
    onResize: (newWidth: number) => void;
    onReset?: () => void;
}

const ResizeHandle: React.FC<ResizeHandleProps> = ({
    startWidth,
    minWidth,
    maxWidth,
    onResize,
    onReset,
}) => {
    const { t } = useTranslation('common');
    const dragRef = useRef<{ x: number; w: number } | null>(null);

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        dragRef.current = { x: e.clientX, w: startWidth };
        document.body.style.cursor = 'col-resize';
    };
    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragRef.current) return;
        const dx = e.clientX - dragRef.current.x;
        const proposed = dragRef.current.w + dx;
        const clamped = Math.max(minWidth, Math.min(maxWidth, proposed));

        // When we hit a bound, slide the reference forward so reversing the
        // drag direction responds immediately instead of needing to undo the
        // overshoot first.
        if (clamped !== proposed) {
            dragRef.current.x = e.clientX;
            dragRef.current.w = clamped;
        }
        onResize(clamped);
    };
    const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragRef.current) return;
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        dragRef.current = null;
        document.body.style.cursor = '';
    };

    return (
        <Tooltip title={t('playPage.resizeTooltip')} placement="top">
            <Box
                role="separator"
                aria-orientation="vertical"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onDoubleClick={() => onReset?.()}
                sx={theme => ({
                    position: 'relative',
                    // Wide drag zone so the handle is the visual gap between
                    // columns rather than a thin sliver flush against the right
                    // edge of the column.
                    width: 28,
                    flexShrink: 0,
                    cursor: 'col-resize',
                    touchAction: 'none',
                    '&::after': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: '50%',
                        width: '1px',
                        bgcolor: theme.palette.divider,
                        transform: 'translateX(-50%)',
                        transition: theme.transitions.create(
                            ['background-color', 'width'],
                            {
                                duration: 120,
                            },
                        ),
                    },
                    '&:hover::after, &:active::after': {
                        bgcolor: theme.palette.primary.main,
                        width: '2px',
                    },
                })}
            />
        </Tooltip>
    );
};

const Page = () => {
    const { t } = useTranslation('common');
    const play = usePlayEntry();
    const router = useRouter();
    const {
        name,
        entries,
        updateEntry,
        deleteEntry,
        createEntry,
        reorderEntries,
    } = useRundownEntries(router.query.id as string);

    const [editing, setEditing] = useState<RundownEntry | null>(null);
    const [adding, setAdding] = useState(false);
    const [locked, setLocked] = useState(true);

    const [widths, setWidth] = useColumnWidths();

    const sideColumnRef = useRef<HTMLDivElement>(null);
    useDragAutoScroll(sideColumnRef);

    // When the user drops a payload onto a specific spot in the list we
    // remember the target index here so that whenever the editor modal saves
    // (after pre-fill / edit) the new entry lands at that position rather
    // than at the end. Cleared whenever the modal closes.
    const [pendingDropIndex, setPendingDropIndex] = useState<
        number | undefined
    >(undefined);

    const openEditorForDrop = (
        payload: RundownItemDragPayload,
        index?: number,
    ) => {
        setEditing({
            id: Math.random().toString(36).substring(2, 11),
            title: payload.title ?? t('playPage.detail.newItemTitle'),
            type: payload.type,
            data: payload.data ?? {},
        });
        setPendingDropIndex(index);
    };

    const handleSetEditing = (next: RundownEntry | null) => {
        setEditing(next);
        if (next === null) setPendingDropIndex(undefined);
    };

    const createEntryAtPending = (entry: RundownEntry) =>
        createEntry(entry, pendingDropIndex);

    return (
        <RundownLiveProvider live={!locked}>
            <DefaultContentLayout>
                <Stack sx={{ height: '100%', minHeight: 0 }}>
                    <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        gap={2}
                        mb={2}
                        sx={{
                            flexShrink: 0,
                            // Match the column row's `px: 1` so the title's left
                            // edge aligns with the column-title text below it.
                            px: 1,
                        }}
                    >
                        <Stack
                            direction="row"
                            alignItems="center"
                            gap={1.5}
                            flexWrap="wrap"
                            sx={{ minWidth: 0 }}
                        >
                            <Stack
                                direction="row"
                                alignItems="stretch"
                                gap={1.5}
                                sx={{ minWidth: 0 }}
                            >
                                <Box
                                    sx={theme => ({
                                        width: 3,
                                        borderRadius: 2,
                                        bgcolor: theme.palette.primary.main,
                                        // The bar anchors the title even when the
                                        // text is short; stretching to the line
                                        // box keeps it tied to the text height.
                                        alignSelf: 'stretch',
                                    })}
                                />
                                <Typography
                                    variant="h2"
                                    sx={{
                                        fontSize: '1.75rem',
                                        lineHeight: 1.2,
                                        wordBreak: 'break-word',
                                        color: name
                                            ? 'text.primary'
                                            : 'text.disabled',
                                    }}
                                >
                                    {name ?? t('playPage.detail.untitled')}
                                </Typography>
                            </Stack>
                            {locked ? <EditIndicator /> : <LiveIndicator />}
                        </Stack>
                        <LockToggle
                            locked={locked}
                            onToggle={() => setLocked(l => !l)}
                            label={t('playPage.detail.itemsLabel')}
                        />
                    </Stack>

                    <Stack
                        direction="row"
                        alignItems="stretch"
                        sx={{
                            flex: 1,
                            minHeight: 0,
                            // Horizontal scroll for narrow viewports; vertical
                            // scrolling lives inside each column so they don't
                            // share a single scroll state.
                            overflowX: 'auto',
                            overflowY: 'hidden',
                            // Small left/right insets so the drop-zone outline
                            // (outlineOffset: 4) on the edge columns isn't clipped
                            // by the row's overflow.
                            px: 1,
                        }}
                    >
                        <Box
                            sx={{
                                width: widths[0],
                                flexShrink: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                minHeight: 0,
                                gap: 2,
                            }}
                        >
                            <Typography variant="h2">
                                {t('playPage.detail.rundownHeading')}
                            </Typography>
                            <Rundowns
                                entries={entries}
                                locked={locked}
                                onEdit={entry => setEditing(entry)}
                                onPlay={play}
                                onAdd={() => setAdding(true)}
                                onDelete={deleteEntry}
                                onDropItem={openEditorForDrop}
                                onReorder={reorderEntries}
                            />
                        </Box>

                        <ResizeHandle
                            startWidth={widths[0]}
                            minWidth={MIN_COLUMN_WIDTH}
                            maxWidth={MAX_COLUMN_WIDTH}
                            onResize={w => setWidth(0, w)}
                            onReset={() => setWidth(0, COLUMN_DEFAULTS[0])}
                        />

                        <Box
                            sx={{
                                width: widths[1],
                                flexShrink: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                minHeight: 0,
                                gap: 2,
                            }}
                        >
                            <Stack spacing={0.5}>
                                <Typography variant="h2">
                                    {t('playPage.detail.quickActionsHeading')}
                                </Typography>
                                <Typography
                                    variant="body2"
                                    sx={{ color: 'text.secondary' }}
                                >
                                    {t(
                                        'playPage.detail.quickActionsDescription',
                                    )}
                                </Typography>
                            </Stack>
                            <QuickActions locked={locked} />
                        </Box>

                        <ResizeHandle
                            startWidth={widths[1]}
                            minWidth={MIN_COLUMN_WIDTH}
                            maxWidth={MAX_COLUMN_WIDTH}
                            onResize={w => setWidth(1, w)}
                            onReset={() => setWidth(1, COLUMN_DEFAULTS[1])}
                        />

                        <Box
                            sx={{
                                width: widths[2],
                                flexShrink: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                minHeight: 0,
                            }}
                        >
                            <Box
                                ref={sideColumnRef}
                                className="no-scrollbar"
                                sx={{
                                    flex: 1,
                                    minHeight: 0,
                                    overflowY: 'auto',
                                }}
                            >
                                <Injections
                                    zone={UI_INJECTION_ZONE.RUNDOWN_SIDE}
                                />
                                <Box
                                    aria-hidden
                                    sx={{
                                        height: 'calc(100% - 200px)',
                                        minHeight: 120,
                                    }}
                                />
                            </Box>
                            {/* Pinned to the bottom of the column — sits below
                            the scrollable injection area so it's always in
                            view while plugins above scroll. */}
                            <RundownPreview />
                        </Box>
                    </Stack>

                    <BottomPanel />
                </Stack>

                <RundownModals
                    editing={editing}
                    setEditing={handleSetEditing}
                    adding={adding}
                    setAdding={setAdding}
                    entries={entries}
                    updateEntry={updateEntry}
                    createEntry={createEntryAtPending}
                    deleteEntry={deleteEntry}
                />
            </DefaultContentLayout>
        </RundownLiveProvider>
    );
};

export default Page;
