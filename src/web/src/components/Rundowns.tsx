import {Injections, UI_INJECTION_ZONE} from '../lib/api/inject';
import {Box, Button, IconButton, Stack, Tooltip, Typography, alpha} from '@mui/material';
import {keyframes} from '@mui/system';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import LockOpenRoundedIcon from '@mui/icons-material/LockOpenRounded';
import React, {useEffect, useState} from 'react';
import {useSocket} from '../lib';

export interface RundownEntry {
    id: string;
    title: string;
    data: any;

    type?: string;
}

export function useRundownEntries(rundown: string) {
    const conn = useSocket();
    const [entries, setEntries] = useState<RundownEntry[]>([]);

    useEffect(() => {
        if (!rundown) return;
        conn.rawRequest(`/api/rundown/${rundown}`, 'GET', {}).then(entries => setEntries(entries.data.items ?? []));

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
                const { id, entry } = data;
                if (id !== rundown) return;

                setEntries(entries => [...entries, entry]);
            },
        };

        conn.routes.register(updateListener);
        conn.routes.register(deleteListener);
        conn.routes.register(createListener);

        return () => {
            conn.routes.unregister(updateListener);
            conn.routes.unregister(deleteListener);
            conn.routes.unregister(createListener);
        };
    }, [rundown]);

    const createEntry = (entry: RundownEntry) => {
        conn.rawRequest(`/api/rundown/${rundown}/entry`, 'CREATE', entry);
        setEntries([...entries, entry]);
    };

    const updateEntry = (entry: RundownEntry) => {
        conn.rawRequest(`/api/rundown/${rundown}/entry`, 'UPDATE', entry);
        setEntries(entries.map(v => v.id === entry.id ? entry : v));
    };

    const deleteEntry = (entry: RundownEntry) => {
        conn.rawRequest(`/api/rundown/${rundown}/entry`, 'DELETE', entry.id);
        setEntries(entries.filter(v => v.id !== entry.id));
    };

    return {
        entries,

        updateEntry,
        deleteEntry,
        createEntry,
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
}

export const RundownEntry: React.FC<RundownEntryProps> = ({title, type, onEdit, onPlay, active, locked, children}) => {
    const cardClickable = !locked;

    return (
        <Stack
            padding={2}
            spacing={1.5}
            direction="column"
            sx={(theme) => ({
                bgcolor: theme.palette.surface.paper,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 1.5,
                width: '100%',
                cursor: cardClickable ? 'pointer' : 'default',
                transition: theme.transitions.create(['border-color', 'background-color'], { duration: 120 }),
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
    );
};

interface RundownsProps {
    entries: RundownEntry[];

    onEdit: (entry: RundownEntry) => void;
    onPlay: (entry: RundownEntry) => void;
    onAdd: () => void;

    locked?: boolean;
}

export const Rundowns: React.FC<RundownsProps> = ({entries, onEdit, onPlay, onAdd, locked}) => {
    return (
        <Stack spacing={1.5}>
            {entries.length === 0 && (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    No items yet. Add one below to get started.
                </Typography>
            )}

            {entries.map(entry => (
                <RundownEntry
                    key={entry.id}
                    title={entry.title}
                    type={entry.type}
                    active={false}
                    locked={locked}
                    onEdit={() => onEdit(entry)}
                    onPlay={() => onPlay(entry)}
                >
                    <Injections zone={`${UI_INJECTION_ZONE.RUNDOWN_ITEM}.${entry.type}`} props={{entry}} />
                </RundownEntry>
            ))}

            <Button
                variant="contained"
                fullWidth
                sx={{ mt: 0.5 }}
                onClick={() => onAdd()}
            >
                Add item
            </Button>
        </Stack>
    );
};

const LIVE_RED = '#e0463a';

const livePulse = keyframes`
    0%, 100% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 ${alpha(LIVE_RED, 0.6)}; }
    50% { transform: scale(1.15); opacity: 0.85; box-shadow: 0 0 0 6px ${alpha(LIVE_RED, 0)}; }
`;

/** Shown when the rundown is unlocked — items will fire on card click. */
export const LiveIndicator: React.FC = () => (
    <Stack
        direction="row"
        alignItems="center"
        gap={0.75}
        sx={{
            px: 1.25,
            py: 0.5,
            borderRadius: 999,
            bgcolor: alpha(LIVE_RED, 0.14),
            border: `1px solid ${alpha(LIVE_RED, 0.45)}`,
            color: LIVE_RED,
        }}
    >
        <Box
            sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: LIVE_RED,
                animation: `${livePulse} 1.4s ease-in-out infinite`,
            }}
        />
        <Typography
            variant="caption"
            sx={{ fontWeight: 700, letterSpacing: '0.12em', fontSize: '0.7rem' }}
        >
            LIVE
        </Typography>
    </Stack>
);

interface LockToggleProps {
    locked: boolean;
    onToggle: () => void;
    label?: string;
}

export const LockToggle: React.FC<LockToggleProps> = ({ locked, onToggle, label }) => (
    <Tooltip title={
        locked
            ? `${label ?? 'Items'} are locked — clicking a card won\'t fire it. Use the play button.`
            : `${label ?? 'Items'} are unlocked — click anywhere on a card to fire it.`
    }>
        <IconButton
            size="small"
            onClick={onToggle}
            sx={(theme) => ({
                color: locked ? theme.palette.primary.main : 'text.secondary',
                border: `1px solid ${locked ? theme.palette.primary.main : theme.palette.divider}`,
                borderRadius: 1.5,
                px: 1.25,
                py: 0.5,
                gap: 0.75,
                '&:hover': { borderColor: theme.palette.primary.main, color: theme.palette.primary.main },
            })}
        >
            {locked ? <LockRoundedIcon fontSize="small" /> : <LockOpenRoundedIcon fontSize="small" />}
            <Typography variant="caption" sx={{ fontWeight: 500 }}>
                {locked ? 'Locked' : 'Unlocked'}
            </Typography>
        </IconButton>
    </Tooltip>
);