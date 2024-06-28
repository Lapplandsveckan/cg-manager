import {Button, MenuItem, Modal, Select, Stack, Typography} from '@mui/material';
import {Injections, UI_INJECTION_ZONE} from '../lib/api/inject';
import React, {useEffect, useState} from 'react';
import {RundownEntry} from './Rundowns';
import {useSocket} from '../lib';

interface BaseModalProps {
    editing: RundownEntry | null;
    setEditing: (entry: RundownEntry | null) => void;

    adding: boolean;
    setAdding: (adding: boolean) => void;

    entries: RundownEntry[];
    updateEntry: (entry: RundownEntry) => void;
    createEntry: (entry: RundownEntry) => void;
    deleteEntry: (entry: RundownEntry) => void;
}

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
};

const EditorModal: React.FC<BaseModalProps> = ({
    editing,
    setEditing, adding,
    setAdding,
    entries,
    updateEntry,
    createEntry,
    deleteEntry,
}) => {
    return (
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
    );
};

const AddModal: React.FC<BaseModalProps> = ({ setEditing, adding, setAdding }) => {
    return (
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
    );
};

export const RundownModals: React.FC<BaseModalProps> = (props) => {
    return (
        <>
            <EditorModal {...props} />
            <AddModal {...props} />
        </>
    );
};