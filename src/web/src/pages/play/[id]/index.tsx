import React, {useState} from 'react';
import {Box, Stack, Typography} from '@mui/material';
import {DefaultContentLayout} from '../../../components/DefaultContentLayout';
import {useSocket} from '../../../lib/hooks/useSocket';
import {Injections, UI_INJECTION_ZONE} from '../../../lib/api/inject';
import {useRouter} from 'next/router';
import {LiveIndicator, LockToggle, RundownEntry, Rundowns, useRundownEntries} from '../../../components/Rundowns';
import {RundownModals} from '../../../components/RundownModals';
import {QuickActions} from '../../../components/QuickActions';

const Page = () => {
    const conn = useSocket();
    const router = useRouter();
    const {entries, updateEntry, deleteEntry, createEntry} = useRundownEntries(router.query.id as string);

    const [editing, setEditing] = useState<RundownEntry | null>(null);
    const [adding, setAdding] = useState(false);
    const [locked, setLocked] = useState(true);

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
                        <Typography variant="h1">Run rundown</Typography>
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
                gap={5}
                flexWrap="wrap"
                sx={{ minHeight: 0 }}
            >
                <Stack direction="column" spacing={2} sx={{ minWidth: 520 }}>
                    <Typography variant="h2">Rundown</Typography>
                    <Rundowns
                        entries={entries}
                        locked={locked}
                        onEdit={entry => setEditing(entry)}
                        onPlay={entry => conn.rawRequest('/api/rundown/execute', 'ACTION', { entry })}
                        onAdd={() => setAdding(true)}
                    />
                </Stack>

                <Stack direction="column" spacing={2} sx={{ minWidth: 520 }}>
                    <Stack spacing={0.5}>
                        <Typography variant="h2">Quick actions</Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            Reusable cue lists you can trigger with one click.
                        </Typography>
                    </Stack>
                    <QuickActions locked={locked} />
                </Stack>

                <Box>
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
