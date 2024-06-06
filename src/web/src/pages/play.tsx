import {DefaultContentLayout} from '../components/DefaultContentLayout';
import {useSocket} from '../lib/hooks/useSocket';
import {Button, Modal, Stack, Typography} from '@mui/material';
import {useState} from 'react';

interface RundownEntryProps {
    title: string;

    onEdit: () => void;
    onPlay: () => void;

    active: boolean;
    children: React.ReactNode;
}

const RundownEntry: React.FC<RundownEntryProps> = ({title, onEdit, onPlay, active, children}) => {
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
                direction="row"
            >
                {children}
            </Stack>
        </Stack>
    );
};

interface RundownEntry {
    id: string;
    title: string;
    data: any;
}

const Page = () => {
    const conn = useSocket();
    const [entries, setEntries] = useState<RundownEntry[]>([{
        id: '1',
        title: 'Rundown 1',
        data: 'This is the data for Rundown 1',
    }]);

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
                        active={false}
                        onEdit={() => {
                            console.log('edit');
                        }}
                        onPlay={() => {
                            console.log('play');
                        }}
                    >
                        <Typography>
                            {entry.data}
                        </Typography>
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
                            data: '',
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
                        padding={2}
                        direction="column"
                        sx={{
                            backgroundColor: '#272930',
                            borderRadius: 4,
                            width: '500px',
                        }}
                    >
                        <Typography variant="h6">
                            Edit Rundown
                        </Typography>
                        <Stack
                            spacing={2}
                            direction="row"
                        >

                        </Stack>
                    </Stack>
                </Modal>
            </Stack>
        </DefaultContentLayout>
    );
};

export default Page;