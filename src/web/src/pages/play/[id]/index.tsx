import {DefaultContentLayout} from '../../../components/DefaultContentLayout';
import {useSocket} from '../../../lib/hooks/useSocket';
import {Button, MenuItem, Modal, Select, Stack, Typography} from '@mui/material';
import React, {useEffect, useState} from 'react';
import {Injections, UI_INJECTION_ZONE} from '../../../lib/api/inject';
import {useRouter} from 'next/router';

interface RundownEntryProps {
    title: string;
    type: string;

    onEdit: () => void;
    onPlay: () => void;

    active: boolean;
    children: React.ReactNode;
}

interface RundownEntry {
    id: string;
    title: string;
    data: any;

    type?: string;
}

function useRundownEntries(rundown: string) {
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
        }

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
    }

    return {
        entries,

        updateEntry,
        deleteEntry,
        createEntry,
    };
}

const RundownEntry: React.FC<RundownEntryProps> = ({title, type, onEdit, onPlay, active, children}) => {
    return (
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
    );
};

const AddRundownEntry: React.FC<{ onChoose: (type: string) => void }> = ({onChoose}) => {
    const conn = useSocket();
    const [type, setType] = useState<string>('null');
    const [types, setTypes] = useState<string[]>([]);

    useEffect(() => {
        conn.rawRequest('/api/rundown/types', 'GET', {}).then(types => setTypes(types.data ?? []));
    }, []);

    return (
        <>
            <Typography variant="h6">Select Rundown Entry Type</Typography>
            <Select
                variant="outlined"
                label="Type"
                color="primary"
                value={type}
                onChange={async (event) => setType(event.target.value as string)}
            >
                <MenuItem value={'null'}>(Select Type)</MenuItem>
                {
                    types.map(t => (
                        <MenuItem value={t} key={t}>{t}</MenuItem>
                    ))
                }
            </Select>
            <Button
                onClick={() => onChoose(type)}
            >
                Continue
            </Button>
        </>
    );
}

const Page = () => {
    const conn = useSocket();
    const router = useRouter();
    const {entries, updateEntry, deleteEntry, createEntry} = useRundownEntries(router.query.id as string);

    const [editing, setEditing] = useState<RundownEntry | null>(null);
    const [adding, setAdding] = useState(false);
    return (
        <DefaultContentLayout>
            <h1>Play</h1>

            <Stack
                spacing={3}
            >
                {entries.map(entry => (
                    <RundownEntry
                        key={entry.id}
                        title={entry.title}
                        type={entry.type}
                        active={false}
                        onEdit={() => setEditing(entry)}
                        onPlay={async () => {
                            await conn.rawRequest(`/api/rundown/execute`, 'ACTION', {
                                entry,
                            });
                        }}
                    >
                        <Injections zone={`${UI_INJECTION_ZONE.RUNDOWN_ITEM}.${entry.type}`} props={{entry}} />
                    </RundownEntry>
                ))}

                <Button
                    sx={{
                        width: '500px',
                    }}
                    onClick={() => setAdding(true)}
                >
                    Add Rundown Entry
                </Button>

                <Modal
                    open={editing !== null}
                    onClose={() => setEditing(null)}
                >
                    <Stack
                      justifyContent="center"
                      alignItems="center"

                      sx={{
                        position: 'absolute' as 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                      }}
                    >

                        <Stack
                            padding={2}
                            spacing={2}
                            direction="column"
                            sx={{
                                backgroundColor: '#272930',
                                borderRadius: 4,
                                width: '500px',
                            }}
                        >
                            {
                                editing !== null && (
                                    <Injections zone={`${UI_INJECTION_ZONE.RUNDOWN_EDITOR}.${editing.type}`} props={{
                                        entry: editing,
                                        creating: !entries.some(e => e.id === editing.id),

                                        updateEntry: (entry: RundownEntry) => {
                                            setEditing(null);
                                            if (entries.some(e => e.id === entry.id)) return updateEntry(entry);

                                            createEntry(entry);
                                        },

                                        deleteEntry: (entry: RundownEntry) => {
                                            setEditing(null);
                                            deleteEntry(entry);
                                        },
                                    }} />
                                )
                            }
                        </Stack>
                    </Stack>
                </Modal>

                <Modal
                    open={adding}
                    onClose={() => setAdding(false)}
                >
                    <Stack
                        justifyContent="center"
                        alignItems="center"

                        sx={{
                            position: 'absolute' as 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                        }}
                    >
                        <Stack
                            padding={2}
                            spacing={2}
                            direction="column"
                            sx={{
                                backgroundColor: '#272930',
                                borderRadius: 4,
                                width: '500px',
                            }}
                        >
                            <AddRundownEntry onChoose={type => {
                                setAdding(false);
                                setEditing({
                                    id: Math.random().toString(36).substring(7),
                                    title: 'New Rundown Item',
                                    data: {},
                                    type,
                                });
                            }} />
                        </Stack>
                    </Stack>
                </Modal>
            </Stack>
        </DefaultContentLayout>
    );
};

export default Page;