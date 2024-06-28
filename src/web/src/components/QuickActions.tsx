import {Injections, UI_INJECTION_ZONE} from '../lib/api/inject';
import {Button, Stack, ToggleButtonGroup, ToggleButton, Modal} from '@mui/material';
import React, {useEffect, useState} from 'react';
import {useSocket} from '../lib';
import {EditRundown, Rundown} from '../pages/play';
import {RundownModals} from './RundownModals';
import {RundownEntry, useRundownEntries} from './Rundowns';

function useQuickActions() {
    const conn = useSocket();
    const [quickActions, setQuickActions] = useState<Rundown[]>([]);

    useEffect(() => {
        conn.rawRequest('/api/rundown/quick', 'GET', {}).then(quickActions => setQuickActions(quickActions.data ?? []));

        const updateListener = {
            path: 'rundown',
            method: 'UPDATE',

            handler: request =>
                setQuickActions(quickActions =>
                    quickActions.map(v => v.id === request.getData().id ? {...v, name: request.getData().name} : v),
                ),
        };

        const deleteListener = {
            path: 'rundown',
            method: 'DELETE',

            handler: request =>
                setQuickActions(quickActions =>
                    quickActions.filter(v => v.id !== request.getData()),
                ),
        };

        const createListener = {
            path: 'rundown',
            method: 'CREATE',

            handler: request =>
                request.getData().type === 'quick' && setQuickActions(
                    quickActions => [...quickActions, request.getData()],
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


    const updateQuickAction = (entry: Rundown) => {
        conn.rawRequest(`/api/rundown/${entry.id}`, 'UPDATE', entry.name);
        setQuickActions(quickActions.map(v => v.id === entry.id ? {...v, name: entry.name} : v));
    };

    const deleteQuickAction = (entry: Rundown) => {
        conn.rawRequest(`/api/rundown/${entry.id}`, 'DELETE', null);
        setQuickActions(quickActions.filter(v => v.id !== entry.id));
    };

    const createQuickAction = (name: string) => {
        conn.rawRequest('/api/rundown/quick', 'CREATE', name)
            .then(({ data }) => setQuickActions([...quickActions, data]));
    };

    return {
        quickActions,

        updateQuickAction,
        deleteQuickAction,
        createQuickAction,
    };
}

interface QuickActionsProps {

}

export const QuickActions: React.FC<QuickActionsProps> = ({}) => {
    const conn = useSocket();
    const [quickAction, setQuickAction] = useState<string | null>(null);
    const {entries, updateEntry, deleteEntry, createEntry} = useRundownEntries(quickAction);

    useEffect(() => {
        if (quickAction !== null) return window.localStorage.setItem('quickAction', quickAction);

        const qa = window.localStorage.getItem('quickAction');
        if (qa !== null) setQuickAction(qa);
    }, [quickAction]);

    const {
        quickActions,

        updateQuickAction,
        deleteQuickAction,
        createQuickAction,
    } = useQuickActions();

    const [quickEditing, setQuickEditing] = useState<Rundown | null>(null);
    const [editing, setEditing] = useState<RundownEntry | null>(null);
    const [adding, setAdding] = useState(false);

    return (
        <>
            <Stack
                spacing={3}
                direction="column"
            >
                <Stack spacing={1} direction="row">
                    <ToggleButtonGroup
                        value={quickAction}
                        exclusive
                        onChange={(event, value) => setQuickAction(value)}
                    >
                        {
                            quickActions.map(rundown => (
                                <ToggleButton
                                    value={rundown.id}
                                    aria-label={rundown.name}
                                    key={rundown.id}

                                    onClick={e => {
                                        if (quickAction !== rundown.id) return;

                                        e.preventDefault();
                                        setQuickEditing(rundown);
                                    }}
                                >
                                    {rundown.name}
                                </ToggleButton>
                            ))
                        }
                    </ToggleButtonGroup>

                    <Button
                        onClick={() => createQuickAction('New Quickactions')}
                    >
                        Create Rundown
                    </Button>
                </Stack>

                {entries.map(entry => (
                    <RundownEntry
                        key={entry.id}
                        title={entry.title}
                        type={entry.type}
                        active={false}
                        onEdit={() => setEditing(entry)}
                        onPlay={() => conn.rawRequest('/api/rundown/execute', 'ACTION', { entry })}
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

            <Modal
                open={quickEditing !== null}
                onClose={() => setQuickEditing(null)}
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
                            rundown={quickEditing}
                            onUpdate={(entry) => {
                                updateQuickAction(entry);
                                setQuickEditing(null);
                            }}
                            onDelete={() => {
                                deleteQuickAction(quickEditing);
                                setQuickEditing(null);
                            }}
                        />
                    </Stack>
                </Stack>
            </Modal>
        </>
    );
};