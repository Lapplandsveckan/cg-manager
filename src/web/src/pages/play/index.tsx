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
            sx={{
                backgroundColor: '#272930',
                borderRadius: 4,
                width: '500px',
                cursor: 'pointer',
            }}

            onClick={e => {
                e.stopPropagation();
                router.push(`/play/${id}`);
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
            <h1>Play</h1>

            <Stack
                spacing={3}
            >
                {rundowns.map(entry => (
                    <Rundown
                        key={entry.id}
                        id={entry.id}
                        title={entry.name}

                        onEdit={() => setEditing(entry)}
                    />
                ))}

                <Button
                    sx={{
                        width: '500px',
                    }}
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
                            padding={2}
                            spacing={2}
                            direction="column"
                            sx={{
                                backgroundColor: '#272930',
                                borderRadius: 4,
                                width: '500px',
                            }}
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
                            padding={2}
                            spacing={2}
                            direction="column"
                            sx={{
                                backgroundColor: '#272930',
                                borderRadius: 4,
                                width: '500px',
                            }}
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