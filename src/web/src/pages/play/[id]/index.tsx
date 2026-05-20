import React, {useEffect, useRef, useState} from 'react';
import {Box, Stack, Tooltip, Typography} from '@mui/material';
import {DefaultContentLayout} from '../../../components/DefaultContentLayout';
import {useSocket} from '../../../lib/hooks/useSocket';
import {Injections, UI_INJECTION_ZONE} from '../../../lib/api/inject';
import {useRouter} from 'next/router';
import {LiveIndicator, LockToggle, RundownEntry, Rundowns, useRundownEntries} from '../../../components/Rundowns';
import {RundownModals} from '../../../components/RundownModals';
import {QuickActions} from '../../../components/QuickActions';

// Default sizes target ~80% of the previous defaults (560/560/480) so the
// three columns fit comfortably side-by-side on a standard 1440px viewport
// without scrolling. Bounds let you squeeze further when space is tight and
// give each column a hard ceiling so one doesn't eat the row.
const COLUMN_DEFAULTS = [450, 450, 380];
const MIN_COLUMN_WIDTH = 220;
const MAX_COLUMN_WIDTH = 700;
const STORAGE_KEY = 'play-column-widths';

function clampWidth(w: number): number {
    return Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, Math.round(w)));
}

function loadStoredWidths(): number[] | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed) || parsed.length !== COLUMN_DEFAULTS.length) return null;
        return parsed.map((v) => clampWidth(Number(v) || MIN_COLUMN_WIDTH));
    } catch {
        return null;
    }
}

function useColumnWidths(): [number[], (index: number, width: number) => void] {
    const [widths, setWidths] = useState<number[]>(COLUMN_DEFAULTS);

    useEffect(() => {
        const stored = loadStoredWidths();
        if (stored) setWidths(stored);
    }, []);

    const setWidth = (index: number, width: number) => {
        setWidths((prev) => {
            const next = prev.map((v, i) => i === index ? clampWidth(width) : v);
            try {
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            } catch {
                // best-effort persistence; ignore quota/private-mode errors
            }
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

const ResizeHandle: React.FC<ResizeHandleProps> = ({ startWidth, minWidth, maxWidth, onResize, onReset }) => {
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
        <Tooltip title="Drag to resize · Double-click to reset" placement="top">
            <Box
                role="separator"
                aria-orientation="vertical"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onDoubleClick={() => onReset?.()}
                sx={(theme) => ({
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
                        transition: theme.transitions.create(['background-color', 'width'], { duration: 120 }),
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
    const conn = useSocket();
    const router = useRouter();
    const {entries, updateEntry, deleteEntry, createEntry} = useRundownEntries(router.query.id as string);

    const [editing, setEditing] = useState<RundownEntry | null>(null);
    const [adding, setAdding] = useState(false);
    const [locked, setLocked] = useState(true);

    const [widths, setWidth] = useColumnWidths();

    return (
        <DefaultContentLayout>
            <Stack
                direction="row"
                alignItems="flex-start"
                justifyContent="space-between"
                gap={2}
                mb={4}
            >
                <Stack spacing={1}>
                    <Stack direction="row" alignItems="center" gap={2}>
                        <Typography variant="h1">{locked ? 'Edit rundown' : 'Play rundown'}</Typography>
                        {!locked && <LiveIndicator />}
                    </Stack>
                    <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                        {locked
                            ? 'Editing safely — items only fire from the play button. Unlock for one-click playback.'
                            : 'Live — click anywhere on a card to fire it. Lock for safe editing.'}
                    </Typography>
                </Stack>
                <LockToggle locked={locked} onToggle={() => setLocked(l => !l)} label="Items" />
            </Stack>

            <Stack
                direction="row"
                alignItems="stretch"
                sx={{ overflowX: 'auto', overflowY: 'visible', minHeight: 0, pb: 1 }}
            >
                <Box sx={{ width: widths[0], flexShrink: 0 }}>
                    <Stack direction="column" spacing={2}>
                        <Typography variant="h2">Rundown</Typography>
                        <Rundowns
                            entries={entries}
                            locked={locked}
                            onEdit={entry => setEditing(entry)}
                            onPlay={entry => conn.rawRequest('/api/rundown/execute', 'ACTION', { entry })}
                            onAdd={() => setAdding(true)}
                        />
                    </Stack>
                </Box>

                <ResizeHandle
                    startWidth={widths[0]}
                    minWidth={MIN_COLUMN_WIDTH}
                    maxWidth={MAX_COLUMN_WIDTH}
                    onResize={(w) => setWidth(0, w)}
                    onReset={() => setWidth(0, COLUMN_DEFAULTS[0])}
                />

                <Box sx={{ width: widths[1], flexShrink: 0 }}>
                    <Stack direction="column" spacing={2}>
                        <Stack spacing={0.5}>
                            <Typography variant="h2">Quick actions</Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                Reusable cue lists you can trigger with one click.
                            </Typography>
                        </Stack>
                        <QuickActions locked={locked} />
                    </Stack>
                </Box>

                <ResizeHandle
                    startWidth={widths[1]}
                    minWidth={MIN_COLUMN_WIDTH}
                    maxWidth={MAX_COLUMN_WIDTH}
                    onResize={(w) => setWidth(1, w)}
                    onReset={() => setWidth(1, COLUMN_DEFAULTS[1])}
                />

                <Box sx={{ width: widths[2], flexShrink: 0 }}>
                    <Injections zone={UI_INJECTION_ZONE.RUNDOWN_SIDE} />
                </Box>
            </Stack>

            <RundownModals
                editing={editing}
                setEditing={setEditing}

                adding={adding}
                setAdding={setAdding}

                entries={entries}
                updateEntry={updateEntry}
                createEntry={createEntry}
                deleteEntry={deleteEntry}
            />
        </DefaultContentLayout>
    );
};

export default Page;
