import { Card, Modal, Stack, Typography, alpha } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { Injections, UI_INJECTION_ZONE } from '../lib/api/inject';
import { type RundownEntry } from './Rundowns';
import { useSocket } from '../lib';

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

// Best-effort prettifier for raw plugin action ids until plugins ship metadata
// (display name, description, category). Handles kebab-case, snake_case, and
// camelCase. The original id is shown underneath as a code-like hint.
function formatTypeLabel(id: string): string {
    return id
        .replace(/[-_]+/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, c => c.toUpperCase());
}

const TypeTile: React.FC<{ id: string; onPick: () => void }> = ({
    id,
    onPick,
}) => {
    const { t } = useTranslation('common');
    // Prefer a per-id translation under rundown.actionLabels.<id>; fall back
    // to the title-cased id so server-supplied action ids without a mapping
    // still render readably.
    const labelKey = `rundown.actionLabels.${id}`;
    const translated = t(labelKey);
    const label = translated === labelKey ? formatTypeLabel(id) : translated;
    return (
        <Card
            onClick={onPick}
            sx={theme => ({
                p: 2,
                cursor: 'pointer',
                transition: theme.transitions.create(
                    ['background-color', 'border-color'],
                    {
                        duration: 120,
                    },
                ),
                '&:hover': {
                    bgcolor: theme.palette.surface.raised,
                    borderColor: alpha(theme.palette.primary.main, 0.45),
                },
            })}
        >
            <Stack spacing={0.5}>
                <Typography variant="h5" sx={{ wordBreak: 'break-word' }}>
                    {label}
                </Typography>
                <Typography
                    variant="caption"
                    sx={theme => ({
                        fontFamily: '"SF Mono", "Menlo", "Consolas", monospace',
                        color: theme.palette.text.disabled,
                        wordBreak: 'break-all',
                    })}
                >
                    {id}
                </Typography>
            </Stack>
        </Card>
    );
};

const AddRundownEntry: React.FC<{ onChoose: (type: string) => void }> = ({
    onChoose,
}) => {
    const { t } = useTranslation('common');
    const conn = useSocket();
    const [types, setTypes] = useState<string[] | null>(null);

    useEffect(() => {
        conn.rawRequest('/api/rundown/types', 'GET', {})
            .then(res => setTypes(res.data ?? []))
            .catch(() => setTypes([]));
    }, []);

    return (
        <Stack spacing={2}>
            <Stack spacing={0.5}>
                <Typography variant="h3">
                    {t('rundown.modals.addItem.title')}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {t('rundown.modals.addItem.description')}
                </Typography>
            </Stack>

            {types === null && (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {t('rundown.modals.addItem.loading')}
                </Typography>
            )}

            {types?.length === 0 && (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {t('rundown.modals.addItem.empty')}
                </Typography>
            )}

            {types && types.length > 0 && (
                <Stack
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                        gap: 1.25,
                    }}
                >
                    {types.map(t => (
                        <TypeTile key={t} id={t} onPick={() => onChoose(t)} />
                    ))}
                </Stack>
            )}
        </Stack>
    );
};

export const ModalShell: React.FC<{ children: React.ReactNode; width?: number }> = ({
    children,
    width = 500,
}) => (
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
        <Card
            sx={theme => ({
                padding: 3,
                width,
                bgcolor: theme.palette.surface.elevated,
                border: `1px solid ${theme.palette.divider}`,
            })}
        >
            {children}
        </Card>
    </Stack>
);

const EditorModal: React.FC<BaseModalProps> = ({
    editing,
    setEditing,
    entries,
    updateEntry,
    createEntry,
    deleteEntry,
}) => (
    <Modal open={editing !== null} onClose={() => setEditing(null)}>
        <ModalShell>
            {editing !== null && (
                <Injections
                    zone={`${UI_INJECTION_ZONE.RUNDOWN_EDITOR}.${editing.type}`}
                    props={{
                        entry: editing,
                        creating: !entries.some(e => e.id === editing.id),

                        updateEntry: (entry: RundownEntry) => {
                            setEditing(null);
                            if (entries.some(e => e.id === entry.id))
                                return updateEntry(entry);

                            createEntry(entry);
                        },

                        deleteEntry: (entry: RundownEntry) => {
                            setEditing(null);
                            deleteEntry(entry);
                        },
                    }}
                />
            )}
        </ModalShell>
    </Modal>
);

const AddModal: React.FC<BaseModalProps> = ({
    setEditing,
    adding,
    setAdding,
}) => {
    const { t } = useTranslation('common');
    return (
        <Modal open={adding} onClose={() => setAdding(false)}>
            <ModalShell width={560}>
                <AddRundownEntry
                    onChoose={type => {
                        setAdding(false);
                        setEditing({
                            id: Math.random().toString(36).substring(7),
                            title: t('rundown.newItemDefaultTitle'),
                            data: {},
                            type,
                        });
                    }}
                />
            </ModalShell>
        </Modal>
    );
};

export const RundownModals: React.FC<BaseModalProps> = props => (
    <>
        <EditorModal {...props} />
        <AddModal {...props} />
    </>
);
