import React, {useState} from 'react';
import {DefaultContentLayout} from '../../../components/DefaultContentLayout';
import {useSocket} from '../../../lib/hooks/useSocket';
import {Stack} from '@mui/material';
import {Injections, UI_INJECTION_ZONE} from '../../../lib/api/inject';
import {useRouter} from 'next/router';
import {RundownEntry, Rundowns, useRundownEntries} from '../../../components/Rundowns';
import {RundownModals} from '../../../components/RundownModals';
import {QuickActions} from '../../../components/QuickActions';

const Page = () => {
    const conn = useSocket();
    const router = useRouter();
    const {entries, updateEntry, updateOrder, deleteEntry, createEntry} = useRundownEntries(router.query.id as string);

    const [editing, setEditing] = useState<RundownEntry | null>(null);
    const [adding, setAdding] = useState(false);

    return (
        <DefaultContentLayout>
            <Stack direction="row" spacing={8} sx={{ height: '100%' }}>
                <Stack direction="column">
                    <h1>Rundown</h1>
                    <Stack direction="column" flexGrow={1} sx={{ overflowY: 'auto' }}>
                        <Rundowns
                            entries={entries}

                            onEdit={entry => setEditing(entry)}
                            onPlay={entry => conn.rawRequest('/api/rundown/execute', 'ACTION', { entry })}
                            onAdd={() => setAdding(true)}

                            onReorder={(...entries: RundownEntry[]) => updateOrder(entries)}
                        />
                    </Stack>
                </Stack>

                <Stack direction="column">
                    <h1>Quick Actions</h1>
                    <Stack direction="column" flexGrow={1} sx={{ overflowY: 'auto' }}>
                        <QuickActions />
                    </Stack>
                </Stack>

                <Stack direction="column">
                    <Stack direction="column" flexGrow={1} sx={{ overflowY: 'auto' }}>
                        <Injections zone={UI_INJECTION_ZONE.RUNDOWN_SIDE} />
                    </Stack>
                </Stack>
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
