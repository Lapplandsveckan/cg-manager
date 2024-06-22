import {DefaultContentLayout} from '../components/DefaultContentLayout';
import {useSocket} from '../lib/hooks/useSocket';
import {Button, Modal, Stack, Typography} from '@mui/material';
import React, {useState} from 'react';
import {Injections, UI_INJECTION_ZONE} from '../lib/api/inject';

interface RundownEntryProps {
    title: string;
    type: string;

    onEdit: () => void;
    onPlay: () => void;

    active: boolean;
    children: React.ReactNode;
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
                <Typography>
                    {type}
                </Typography>
                {children}
            </Stack>
        </Stack>
    );
};

interface RundownEntry {
    id: string;
    title: string;
    data: any;

    type?: string;
}



const Page = () => {
    const conn = useSocket();
    const [entries, setEntries] = useState<RundownEntry[]>([{
        id: '1',
        title: 'Rundown 1',
        data: {
            clip: null,
            destination: '1:video',
        },
        type: 'queue-video',
    }]);

    const updateEntry = (entry: RundownEntry) => {
        setEntries(entries.map(e => e.id === entry.id ? entry : e))
        setEditing(null);
    };

    const [editing, setEditing] = useState<RundownEntry | null>(null);
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
                        onEdit={() => {
                            setEditing(entry);
                        }}
                        onPlay={async () => {
                            await conn.rawRequest(`/api/rundown/execute`, 'ACTION', {
                                entry,
                            });
                        }}
                    >
                        {
                            entry.type === 'queue-video' && (
                                <Injections zone={`${UI_INJECTION_ZONE.RUNDOWN_ITEM}.${entry.type}`} props={{entry}} />
                            )
                        }
                    </RundownEntry>
                ))}

                <Button
                    sx={{
                        width: '500px',
                    }}
                    onClick={() => {
                        setEntries([...entries, {
                            id: Math.random().toString(36).substring(7),
                            title: 'New Rundown',
                            data: {
                                clip: null,
                                destination: '1:video',
                            },
                            type: 'queue-video',
                        }]);
                    }}
                >
                    Add Rundown Entry
                </Button>

                <Modal
                    open={editing !== null}
                    onClose={() => {
                        setEditing(null);
                    }}
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
                            direction="column"
                            sx={{
                                backgroundColor: '#272930',
                                borderRadius: 4,
                                width: '500px',
                            }}
                        >
                            {
                                editing !== null && (
                                    <Injections zone={`${UI_INJECTION_ZONE.RUNDOWN_EDITOR}.${editing.type}`} props={{entry: editing, updateEntry: updateEntry}} />
                                )
                            }
                        </Stack>
                    </Stack>
                </Modal>
            </Stack>
        </DefaultContentLayout>
    );
};

export default Page;