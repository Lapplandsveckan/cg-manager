import {
    ButtonBase,
    IconButton,
    Modal,
    Stack,
    Tooltip,
    Typography,
    alpha,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DriveFileRenameOutlineRoundedIcon from '@mui/icons-material/DriveFileRenameOutlineRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { useContextMenu } from './ContextMenuProvider';
import { useSocket } from '../lib';
import { usePlayEntry } from '../lib/hooks/usePlayEntry';
import { useStopEntry } from '../lib/hooks/useStopEntry';
import { EditRundown, type Rundown } from '../pages/play';
import { RundownModals } from './RundownModals';
import { type RundownEntry, Rundowns, useRundownEntries } from './Rundowns';
import { useStoredString } from '../lib/hooks/useStoredString';
import { useRundownDropEditor } from '../lib/hooks/useRundownDropEditor';

function useQuickActions() {
    const conn = useSocket();
    const [quickActions, setQuickActions] = useState<Rundown[]>([]);

    useEffect(() => {
        conn.rawRequest('/api/rundown/quick', 'GET', {}).then(quickActions =>
            setQuickActions(quickActions.data ?? []),
        );

        const updateListener = {
            path: 'rundown',
            method: 'UPDATE',
            handler: (request: any) =>
                setQuickActions(quickActions =>
                    quickActions.map(v =>
                        v.id === request.getData().id
                            ? { ...v, name: request.getData().name }
                            : v,
                    ),
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
                request.getData().type === 'quick' &&
                setQuickActions(quickActions => [
                    ...quickActions,
                    request.getData(),
                ]),
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
        setQuickActions(
            quickActions.map(v =>
                v.id === entry.id ? { ...v, name: entry.name } : v,
            ),
        );
    };

    const deleteQuickAction = (entry: Rundown) => {
        conn.rawRequest(`/api/rundown/${entry.id}`, 'DELETE', null);
        setQuickActions(quickActions.filter(v => v.id !== entry.id));
    };

    const createQuickAction = (name: string): Promise<Rundown | null> =>
        conn
            .rawRequest('/api/rundown/quick', 'CREATE', name)
            .then(({ data }) => {
                setQuickActions([...quickActions, data]);
                return data as Rundown;
            });

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
    onRename: () => void;
    onDelete: () => void;
}

const QuickActionTab: React.FC<QuickActionTabProps> = ({
    rundown,
    active,
    onClick,
    onRename,
    onDelete,
}) => {
    const { t } = useTranslation('common');
    const { openMenu } = useContextMenu();
    return (
        <ButtonBase
            onClick={onClick}
            onContextMenu={e =>
                openMenu(e, [
                    { label: t('actions.open'), onClick },
                    {
                        label: t('actions.rename'),
                        icon: (
                            <DriveFileRenameOutlineRoundedIcon fontSize="small" />
                        ),
                        onClick: onRename,
                    },
                    {
                        label: t('actions.delete'),
                        icon: <DeleteOutlineRoundedIcon fontSize="small" />,
                        danger: true,
                        divider: true,
                        onClick: onDelete,
                    },
                ])
            }
            sx={theme => ({
                px: 1.75,
                py: 0.75,
                borderRadius: 1.5,
                border: `1px solid ${active ? theme.palette.primary.main : theme.palette.divider}`,
                bgcolor: active
                    ? alpha(theme.palette.primary.main, 0.12)
                    : 'transparent',
                color: active
                    ? theme.palette.text.primary
                    : theme.palette.text.secondary,
                transition: theme.transitions.create(
                    ['background-color', 'border-color', 'color'],
                    {
                        duration: 120,
                    },
                ),
                '&:hover': {
                    bgcolor: alpha(
                        theme.palette.primary.main,
                        active ? 0.16 : 0.06,
                    ),
                    color: theme.palette.text.primary,
                },
            })}
        >
            <Typography variant="body1" fontWeight={active ? 600 : 400}>
                {rundown.name}
            </Typography>
        </ButtonBase>
    );
};

interface QuickActionsProps {
    locked?: boolean;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ locked }) => {
    const { t } = useTranslation('common');
    const play = usePlayEntry();
    const stop = useStopEntry();

    const {
        quickActions,
        updateQuickAction,
        deleteQuickAction,
        createQuickAction,
    } = useQuickActions();

    const [quickAction, setQuickAction] = useStoredString('quickAction');
    const { entries, updateEntry, deleteEntry, createEntry, reorderEntries } =
        useRundownEntries(quickAction);

    // Reconcile: clear selection if the saved id no longer exists in the list.
    useEffect(() => {
        if (!quickAction) return;
        if (
            quickActions.length &&
            !quickActions.some(q => q.id === quickAction)
        )
            setQuickAction(null);
    }, [quickActions, quickAction]);

    const selected = quickActions.find(q => q.id === quickAction) ?? null;

    const [quickEditing, setQuickEditing] = useState<Rundown | null>(null);
    const [adding, setAdding] = useState(false);

    // Drop-to-insert is owned by the inner <Rundowns /> — when an item is
    // dropped on a specific spot the hook remembers the index and uses it
    // when the editor saves so the new entry lands in the right place. When
    // the dropped payload sets `immediate`, the hook skips the editor and
    // creates the entry straight away.
    const { editing, setEditing, openEditorForDrop, createEntryAtPending } =
        useRundownDropEditor(createEntry, t('rundown.newItemDefaultTitle'));

    const newId = () => Math.random().toString(36).substring(2, 11);

    const handleDuplicate = (entry: RundownEntry, index: number) =>
        createEntry(
            { ...entry, id: newId(), data: structuredClone(entry.data) },
            index + 1,
        );

    const handlePaste = (entry: RundownEntry, index: number) =>
        createEntry(
            { ...entry, id: newId(), data: structuredClone(entry.data) },
            index + 1,
        );

    return (
        <>
            <Stack spacing={2} sx={{ flex: 1, minHeight: 0 }}>
                <Stack
                    direction="row"
                    alignItems="center"
                    gap={1}
                    flexWrap="wrap"
                >
                    {quickActions.map(rundown => (
                        <QuickActionTab
                            key={rundown.id}
                            rundown={rundown}
                            active={rundown.id === quickAction}
                            onClick={() => setQuickAction(rundown.id)}
                            onRename={() => setQuickEditing(rundown)}
                            onDelete={() => {
                                deleteQuickAction(rundown);
                                if (quickAction === rundown.id)
                                    setQuickAction(null);
                            }}
                        />
                    ))}

                    <Tooltip title={t('rundown.quickActions.new')}>
                        <IconButton
                            size="small"
                            onClick={async () => {
                                const created = await createQuickAction(
                                    t('rundown.quickActions.defaultName'),
                                );
                                if (created) setQuickAction(created.id);
                            }}
                            sx={theme => ({
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
                        <Tooltip
                            title={t('rundown.quickActions.renameOrDelete')}
                        >
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
                    <Typography
                        variant="body2"
                        sx={{ color: 'text.secondary' }}
                    >
                        {t('rundown.quickActions.empty')}
                    </Typography>
                )}

                {selected && (
                    <Rundowns
                        rundownId={selected.id}
                        entries={entries}
                        locked={locked}
                        onEdit={entry => setEditing(entry)}
                        onPlay={play}
                        onStop={stop}
                        onAdd={() => setAdding(true)}
                        onDelete={deleteEntry}
                        onDropItem={openEditorForDrop}
                        onReorder={reorderEntries}
                        onDuplicate={handleDuplicate}
                        onPaste={handlePaste}
                    />
                )}

                {!selected && quickActions.length > 0 && (
                    <Typography
                        variant="body2"
                        sx={{ color: 'text.secondary' }}
                    >
                        {t('rundown.quickActions.selectPrompt')}
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
                createEntry={createEntryAtPending}
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
                        sx={theme => ({
                            bgcolor: theme.palette.surface.elevated,
                            border: `1px solid ${theme.palette.divider}`,
                            borderRadius: 1.5,
                            width: 500,
                        })}
                    >
                        {quickEditing && (
                            <EditRundown
                                rundown={quickEditing}
                                onUpdate={entry => {
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
