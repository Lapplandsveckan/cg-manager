import {Injections, UI_INJECTION_ZONE} from '../lib/api/inject';
import {Button, IconButton, Stack, Typography} from '@mui/material';
import React, {useEffect, useState} from 'react';
import {useSocket} from '../lib';
import UpIcon from '@mui/icons-material/ArrowDropUp';
import DownIcon from '@mui/icons-material/ArrowDropDown';
import Link from 'next/link';

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
                    const ids = new Set(entry.map(item => item.id));

                    let index = 0;
                    return setEntries(entries => entries.map(item => ids.has(item.id) ? entry[index++] : item));
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

    const updateOrder = (data: RundownEntry[]) => {
        conn.rawRequest(`/api/rundown/${rundown}/entry`, 'UPDATE', data);
        const ids = new Set(data.map(item => item.id));

        let index = 0;
        return setEntries(entries => entries.map(item => ids.has(item.id) ? data[index++] : item));
    };

    const deleteEntry = (entry: RundownEntry) => {
        conn.rawRequest(`/api/rundown/${rundown}/entry`, 'DELETE', entry.id);
        setEntries(entries.filter(v => v.id !== entry.id));
    };

    return {
        entries,

        updateEntry,
        updateOrder,
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
    children: React.ReactNode;

    canUp?: boolean;
    canDown?: boolean;

    onUp?: () => void;
    onDown?: () => void;
}

export const RundownEntry: React.FC<RundownEntryProps> = ({
    title, type, onEdit, onPlay, active, children, canUp, onUp, canDown, onDown,
}) => {
    return (
        <Stack
            spacing={2}
            direction="row"
        >
            <Stack
                padding={2}
                direction="column"
                sx={{
                    backgroundColor: '#272930',
                    borderRadius: 4,
                    width: '500px',
                    cursor: 'pointer',
                }}

                onClick={e => {
                    e.stopPropagation();
                    onPlay();
                }}
            >
                <Stack
                    direction="row"
                    justifyContent={'space-between'}
                >
                    <Typography variant="h6">
                        {title}
                    </Typography>
                    <Button
                        onClick={e => {
                            e.stopPropagation();
                            onEdit();
                        }}
                    >
                        Edit
                    </Button>
                </Stack>
                <Stack
                    spacing={2}
                    direction="column"
                >
                    {children}
                </Stack>
            </Stack>
            <Stack direction="column">
                <IconButton
                    size="large"
                    onClick={() => onUp()}
                >
                    <UpIcon htmlColor={canUp ? '#FFF' : '#777'} />
                </IconButton>

                <IconButton
                    size="large"
                    onClick={() => onDown()}
                >
                    <DownIcon htmlColor={canDown ? '#FFF' : '#777'} />
                </IconButton>
            </Stack>
        </Stack>
    );
};

interface RundownsProps {
    entries: RundownEntry[];

    onEdit: (entry: RundownEntry) => void;
    onPlay: (entry: RundownEntry) => void;
    onAdd: () => void;

    onReorder: (a: RundownEntry, b: RundownEntry) => void;
}

export const Rundowns: React.FC<RundownsProps> = ({entries, onEdit, onPlay, onAdd, onReorder}) => {
    return (
        <Stack
            spacing={3}
        >
            {entries.map((entry, index) => (
                <RundownEntry
                    key={entry.id}
                    title={entry.title}
                    type={entry.type}
                    active={false}
                    onEdit={() => onEdit(entry)}
                    onPlay={() => onPlay(entry)}

                    canUp={index > 0}
                    canDown={index < entries.length - 1}

                    onUp={() => onReorder(entry, entries[index - 1])}
                    onDown={() => onReorder(entries[index + 1], entry)}
                >
                    <Injections zone={`${UI_INJECTION_ZONE.RUNDOWN_ITEM}.${entry.type}`} props={{entry}} />
                </RundownEntry>
            ))}

            <Button
                sx={{
                    width: '500px',
                }}
                onClick={() => onAdd()}
            >
                Add Rundown Entry
            </Button>
        </Stack>
    );
};
