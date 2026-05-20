import {Injections, UI_INJECTION_ZONE} from '../lib/api/inject';
import {Button, ButtonBase, IconButton, Modal, Stack, Tooltip, Typography, alpha} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import React, {useEffect, useState} from 'react';
import {useSocket} from '../lib';
import {EditRundown, Rundown} from '../pages/play';
import {RundownModals} from './RundownModals';
import {RundownEntry, useRundownEntries} from './Rundowns';

function useQuickActions() {
    const conn = useSocket();
    const [quickActions, setQuickActions] = useState<Rundown[]>([]);

    useEffect(() => {
        conn.rawRequest('/api/rundown/quick', 'GET', {})
            .then(quickActions => setQuickActions(quickActions.data ?? []));

        const updateListener = {
            path: 'rundown',
            method: 'UPDATE',
            handler: (request: any) =>
                setQuickActions(quickActions =>
                    quickActions.map(v => v.id === request.getData().id ? {...v, name: request.getData().name} : v),
                ),
        };

        const deleteListener = {
            path: 'rundown',
            method: 'DELETE',
            handler: (request: any) =>
                setQuickActions(quickActions =>
                    quickActions.filter(v => v.id !== request.getData()),
                ),
        };

        const createListener = {
            path: 'rundown',
            method: 'CREATE',
            handler: (request: any) =>
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

    const createQuickAction = (name: string): Promise<Rundown | null> => {
        return conn.rawRequest('/api/rundown/quick', 'CREATE', name)
            .then(({ data }) => {
                setQuickActions([...quickActions, data]);
                return data as Rundown;
            });
    };

    return {
        quickActions,

        updateQuickAction,
        deleteQuickAction,
        createQuickAction,
    };
}

interface QuickActionTabProps {
    rundown: Rundown;
    active: boolean;
    onClick: () => void;
}

const QuickActionTab: React.FC<QuickActionTabProps> = ({ rundown, active, onClick }) => (
    <ButtonBase
        onClick={onClick}
        sx={(theme) => ({
            px: 1.75,
            py: 0.75,
            borderRadius: 1.5,
            border: `1px solid ${active ? theme.palette.primary.main : theme.palette.divider}`,
            bgcolor: active ? alpha(theme.palette.primary.main, 0.12) : 'transparent',
            color: active ? theme.palette.text.primary : theme.palette.text.secondary,
            transition: theme.transitions.create(['background-color', 'border-color', 'color'], { duration: 120 }),
            '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, active ? 0.16 : 0.06),
                color: theme.palette.text.primary,
            },
        })}
    >
        <Typography variant="body1" fontWeight={active ? 600 : 400}>{rundown.name}</Typography>
    </ButtonBase>
);

interface QuickActionsProps {
    locked?: boolean;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ locked }) => {
    const conn = useSocket();

    const {
        quickActions,
        updateQuickAction,
        deleteQuickAction,
        createQuickAction,
    } = useQuickActions();

    const [quickAction, setQuickAction] = useState<string | null>(null);
    const {entries, updateEntry, deleteEntry, createEntry} = useRundownEntries(quickAction);

    // Restore the last selected quick action on mount; reconcile if it no
    // longer exists in the list once it arrives.
    useEffect(() => {
        const saved = window.localStorage.getItem('quickAction');
        if (saved) setQuickAction(saved);
    }, []);

    useEffect(() => {
        if (!quickAction) return;
        if (quickActions.length && !quickActions.some(q => q.id === quickAction))
            setQuickAction(null);
    }, [quickActions, quickAction]);

    useEffect(() => {
        if (quickAction) window.localStorage.setItem('quickAction', quickAction);
        else window.localStorage.removeItem('quickAction');
    }, [quickAction]);

    const selected = quickActions.find(q => q.id === quickAction) ?? null;

    const [quickEditing, setQuickEditing] = useState<Rundown | null>(null);
    const [editing, setEditing] = useState<RundownEntry | null>(null);
    const [adding, setAdding] = useState(false);

    return (
        <>
            <Stack spacing={2}>
                <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                    {quickActions.map(rundown => (
                        <QuickActionTab
                            key={rundown.id}
                            rundown={rundown}
                            active={rundown.id === quickAction}
                            onClick={() => setQuickAction(rundown.id)}
                        />
                    ))}

                    <Tooltip title="New quick action">
                        <IconButton
                            size="small"
                            onClick={async () => {
                                const created = await createQuickAction('New quick action');
                                if (created) setQuickAction(created.id);
                            }}
                            sx={(theme) => ({
                                border: `1px dashed ${theme.palette.divider}`,
                                color: theme.palette.text.secondary,
                                '&:hover': {
                                    borderColor: theme.palette.primary.main,
                                    color: theme.palette.primary.main,
                                },
                            })}
                        >
                            <AddRoundedIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>

                    {selected && (
                        <Tooltip title="Rename or delete this quick action">
                            <IconButton
                                size="small"
                                onClick={() => setQuickEditing(selected)}
                                sx={{ color: 'text.secondary' }}
                            >
                                <EditOutlinedIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                </Stack>

                {quickActions.length === 0 && (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        No quick actions yet. Click + above to create one.
                    </Typography>
                )}

                {selected && (
                    <Stack spacing={1.5}>
                        {entries.length === 0 && (
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                No items in <strong>{selected.name}</strong> yet. Add one below.
                            </Typography>
                        )}

                        {entries.map(entry => (
                            <RundownEntry
                                key={entry.id}
                                title={entry.title}
                                type={entry.type}
                                active={false}
                                locked={locked}
                                onEdit={() => setEditing(entry)}
                                onPlay={() => conn.rawRequest('/api/rundown/execute', 'ACTION', { entry })}
                            >
                                <Injections
                                    zone={`${UI_INJECTION_ZONE.RUNDOWN_ITEM}.${entry.type}`}
                                    props={{entry}}
                                />
                            </RundownEntry>
                        ))}

                        <Button
                            variant="contained"
                            sx={{ width: 500, alignSelf: 'flex-start', mt: 0.5 }}
                            onClick={() => setAdding(true)}
                        >
                            Add item
                        </Button>
                    </Stack>
                )}

                {!selected && quickActions.length > 0 && (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Select a quick action above to see its items.
                    </Typography>
                )}
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
                        position: 'absolute',
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
                            borderRadius: 1.5,
                            width: 500,
                        })}
                    >
                        {quickEditing && (
                            <EditRundown
                                rundown={quickEditing}
                                onUpdate={(entry) => {
                                    updateQuickAction(entry);
                                    setQuickEditing(null);
                                }}
                                onDelete={() => {
                                    deleteQuickAction(quickEditing);
                                    setQuickEditing(null);
                                    setQuickAction(null);
                                }}
                                onCancel={() => setQuickEditing(null)}
                            />
                        )}
                    </Stack>
                </Stack>
            </Modal>
        </>
    );
};
