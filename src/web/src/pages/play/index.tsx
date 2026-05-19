import {Button, Modal, Stack, TextField, Typography} from '@mui/material';
import React, {useEffect, useState} from 'react';
import {useRouter} from 'next/router';
import {RundownEditorActionBar, useSocket} from '../../lib';
import {DefaultContentLayout} from '../../components/DefaultContentLayout';

export interface Rundown {
    id: string;
    name: string;

    entries: any[]; // RundownEntry[]
}

interface RundownProps {
    id: string;
    title: string;

    onEdit: () => void;
}


function useRundowns() {
    const conn = useSocket();
    const [rundowns, setRundowns] = useState<Rundown[]>([]);

    useEffect(() => {
        conn.rawRequest('/api/rundown', 'GET', {}).then(rundowns => setRundowns(rundowns.data ?? []));

        const updateListener = {
            path: 'rundown',
            method: 'UPDATE',

            handler: request =>
                setRundowns(rundowns =>
                    rundowns.map(v => v.id === request.getData().id ? {...v, name: request.getData().name} : v),
                ),
        };

        const deleteListener = {
            path: 'rundown',
            method: 'DELETE',

            handler: request =>
                setRundowns(rundowns =>
                    rundowns.filter(v => v.id !== request.getData()),
                ),
        };

        const createListener = {
            path: 'rundown',
            method: 'CREATE',

            handler: request =>
                request.getData().type !== 'quick' && setRundowns(rundowns =>
                    [...rundowns, request.getData()],
                ),
        };

        conn.routes.register(updateListener);
        conn.routes.register(deleteListener);
        conn.routes.register(createListener);

        return () => {
            conn.routes.unregister(updateListener);
            conn.routes.unregister(deleteListener);
            conn.routes.unregister(createListener);
        };
    }, []);


    const updateRundown = (entry: Rundown) => {
        conn.rawRequest(`/api/rundown/${entry.id}`, 'UPDATE', entry.name);
        setRundowns(rundowns.map(v => v.id === entry.id ? {...v, name: entry.name} : v));
    };

    const deleteRundown = (entry: Rundown) => {
        conn.rawRequest(`/api/rundown/${entry.id}`, 'DELETE', null);
        setRundowns(rundowns.filter(v => v.id !== entry.id));
    };

    const createRundown = (name: string) => {
        conn.rawRequest('/api/rundown', 'CREATE', name)
            .then(({ data }) => setRundowns([...rundowns, data]));
    };

    return {
        rundowns,

        updateRundown,
        deleteRundown,
        createRundown,
    };
}


const Rundown: React.FC<RundownProps> = ({id, title, onEdit}) => {
    const router = useRouter();

    return (
        <Stack
            padding={2}
            direction="column"
            sx={(theme) => ({
                bgcolor: theme.palette.surface.paper,
                borderRadius: 2,
                border: `1px solid ${theme.palette.divider}`,
                width: 500,
                cursor: 'pointer',
                transition: theme.transitions.create(['border-color', 'background-color'], { duration: 120 }),
                '&:hover': {
                    bgcolor: theme.palette.surface.elevated,
                    borderColor: 'primary.main',
                },
            })}

            onClick={e => {
                e.stopPropagation();
                router.push(`/play/${id}`);
            }}
        >
            <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
            >
                <Typography variant="h4">
                    {title}
                </Typography>
                <Button
                    size="small"
                    onClick={e => {
                        e.stopPropagation();
                        onEdit();
                    }}
                >
                    Edit
                </Button>
            </Stack>
        </Stack>
    );
};

const AddRundown: React.FC<{ onCreate: (type: string) => void }> = ({onCreate}) => {
    const [name, setName] = useState('');

    return (
        <>
            <TextField
                label="Name"
                value={name}
                onChange={e => setName(e.target['value'])}
            />

            <RundownEditorActionBar
                exists={true}

                onDelete={() => onCreate('')}
                onSave={() => onCreate(name)}
            />
        </>
    );
};

interface EditRundownProps {
    rundown: Rundown;
    onUpdate: (rundown: Rundown) => void;
    onDelete: () => void;
}

export const EditRundown: React.FC<EditRundownProps> = ({rundown, onUpdate, onDelete}) => {
    const [name, setName] = useState(rundown.name);

    return (
        <>
            <TextField
                label="Namn"
                value={name}
                onChange={e => setName(e.target['value'])}
            />

            <RundownEditorActionBar
                exists={true}

                onDelete={onDelete}
                onSave={() => {
                    onUpdate({
                        ...rundown,
                        name,
                    });
                }}
            />
        </>
    );
};

const Page = () => {
    const {
        rundowns,

        updateRundown,
        deleteRundown,
        createRundown,
    } = useRundowns();

    const [editing, setEditing] = useState<Rundown | null>(null);
    const [adding, setAdding] = useState(false);

    return (
        <DefaultContentLayout>
            <Stack spacing={1} mb={4}>
                <Typography variant="h1">Play</Typography>
                <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                    Run a rundown of scheduled cues, or jump to one to edit its items.
                </Typography>
            </Stack>

            <Stack spacing={2}>
                {rundowns.length === 0 && (
                    <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                        No rundowns yet. Add one below to get started.
                    </Typography>
                )}

                {rundowns.map(entry => (
                    <Rundown
                        key={entry.id}
                        id={entry.id}
                        title={entry.name}

                        onEdit={() => setEditing(entry)}
                    />
                ))}

                <Button
                    variant="contained"
                    sx={{ width: 500, alignSelf: 'flex-start', mt: 1 }}
                    onClick={() => setAdding(true)}
                >
                    Add Rundown
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
                            padding={3}
                            spacing={2}
                            direction="column"
                            sx={(theme) => ({
                                bgcolor: theme.palette.surface.elevated,
                                border: `1px solid ${theme.palette.divider}`,
                                borderRadius: 2,
                                width: 500,
                                boxShadow: 8,
                            })}
                        >
                            <EditRundown
                                rundown={editing}
                                onUpdate={(entry) => {
                                    updateRundown(entry);
                                    setEditing(null);
                                }}
                                onDelete={() => {
                                    deleteRundown(editing);
                                    setEditing(null);
                                }}
                            />
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
                            padding={3}
                            spacing={2}
                            direction="column"
                            sx={(theme) => ({
                                bgcolor: theme.palette.surface.elevated,
                                border: `1px solid ${theme.palette.divider}`,
                                borderRadius: 2,
                                width: 500,
                                boxShadow: 8,
                            })}
                        >
                            <AddRundown onCreate={name => {
                                setAdding(false);
                                if (!name) return;

                                createRundown(name);
                            }} />
                        </Stack>
                    </Stack>
                </Modal>
            </Stack>
        </DefaultContentLayout>
    );
};

export default Page;