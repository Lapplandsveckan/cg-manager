import {
    Button,
    Card,
    CardActionArea,
    Chip,
    IconButton,
    Modal,
    Stack,
    TextField,
    Tooltip,
    Typography,
    alpha,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import React, {useEffect, useMemo, useState} from 'react';
import {useRouter} from 'next/router';
import {useTranslation} from 'next-i18next';
import {RundownEditorActionBar, useSocket} from '../../lib';
import {DefaultContentLayout} from '../../components/DefaultContentLayout';

export interface RundownItem {
    id: string;
    title: string;
    type: string;
    data: unknown;
    metadata?: { autoNext?: boolean };
}

export interface Rundown {
    id: string;
    name: string;
    items: RundownItem[];
    type?: 'rundown' | 'quick';
}

function useRundowns() {
    const conn = useSocket();
    const [rundowns, setRundowns] = useState<Rundown[]>([]);

    useEffect(() => {
        conn.rawRequest('/api/rundown', 'GET', {}).then(res => setRundowns(res.data ?? []));

        const updateListener = {
            path: 'rundown',
            method: 'UPDATE',
            handler: request =>
                setRundowns(prev =>
                    prev.map(v => v.id === request.getData().id ? {...v, name: request.getData().name} : v),
                ),
        };

        const deleteListener = {
            path: 'rundown',
            method: 'DELETE',
            handler: request =>
                setRundowns(prev => prev.filter(v => v.id !== request.getData())),
        };

        const createListener = {
            path: 'rundown',
            method: 'CREATE',
            handler: request =>
                request.getData().type !== 'quick' && setRundowns(prev => [...prev, request.getData()]),
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
        setRundowns(prev => prev.map(v => v.id === entry.id ? {...v, name: entry.name} : v));
    };

    const deleteRundown = (entry: Rundown) => {
        conn.rawRequest(`/api/rundown/${entry.id}`, 'DELETE', null);
        setRundowns(prev => prev.filter(v => v.id !== entry.id));
    };

    const createRundown = (name: string) => {
        conn.rawRequest('/api/rundown', 'CREATE', name)
            .then(({ data }) => setRundowns(prev => [...prev, data]));
    };

    return { rundowns, updateRundown, deleteRundown, createRundown };
}

function formatItemType(type: string): string {
    if (!type) return 'unknown';
    return type
        .split(/[-_]/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function summariseTypes(items: RundownItem[]): { label: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const item of items) counts.set(item.type, (counts.get(item.type) ?? 0) + 1);
    // Sort by descending count, then alphabetical — keeps the dominant type
    // visually first, but stable when counts tie.
    return Array.from(counts.entries())
        .sort(([a, ca], [b, cb]) => cb - ca || a.localeCompare(b))
        .map(([type, count]) => ({label: formatItemType(type), count}));
}

interface RundownCardProps {
    rundown: Rundown;
    onOpen: () => void;
    onEdit: () => void;
    onDelete: () => void;
}

const RundownCard: React.FC<RundownCardProps> = ({rundown, onOpen, onEdit, onDelete}) => {
    const {t} = useTranslation('common');
    const stop = (e: React.MouseEvent | React.SyntheticEvent) => e.stopPropagation();
    const itemCount = rundown.items?.length ?? 0;
    const typeBreakdown = useMemo(() => summariseTypes(rundown.items ?? []), [rundown.items]);

    return (
        <Card sx={{p: 0}}>
            <CardActionArea onClick={onOpen} sx={{p: 2.5, alignItems: 'stretch'}}>
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={2}>
                    <Stack spacing={1.25} sx={{minWidth: 0, flexGrow: 1}}>
                        <Stack direction="row" alignItems="baseline" gap={1.25} flexWrap="wrap">
                            <Typography variant="h4" sx={{wordBreak: 'break-word'}}>
                                {rundown.name || t('playPage.unnamedRundown')}
                            </Typography>
                            <Typography variant="caption" sx={{color: 'text.disabled'}}>
                                {itemCount === 0
                                    ? t('playPage.itemCount.empty')
                                    : t('playPage.itemCount.count', {count: itemCount})}
                            </Typography>
                        </Stack>

                        {typeBreakdown.length === 0 ? (
                            <Typography variant="body2" sx={{color: 'text.disabled'}}>
                                {t('playPage.noItemsHint')}
                            </Typography>
                        ) : (
                            <Stack direction="row" gap={0.75} flexWrap="wrap">
                                {typeBreakdown.map(({label, count}) => (
                                    <Chip
                                        key={label}
                                        size="small"
                                        label={count > 1 ? `${label} × ${count}` : label}
                                        sx={(theme) => ({
                                            bgcolor: alpha(theme.palette.primary.main, 0.08),
                                            borderColor: alpha(theme.palette.primary.main, 0.25),
                                            color: 'text.secondary',
                                        })}
                                        variant="outlined"
                                    />
                                ))}
                            </Stack>
                        )}
                    </Stack>

                    <Stack
                        direction="row"
                        alignItems="center"
                        gap={0.5}
                        sx={{flexShrink: 0}}
                        onClick={stop}
                        onMouseDown={stop}
                    >
                        <Tooltip title={t('actions.rename')}>
                            <IconButton
                                size="small"
                                onClick={(e) => { stop(e); onEdit(); }}
                                sx={{color: 'text.secondary'}}
                            >
                                <EditRoundedIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title={t('actions.delete')}>
                            <IconButton
                                size="small"
                                onClick={(e) => { stop(e); onDelete(); }}
                                sx={{color: '#e88c8c'}}
                            >
                                <DeleteOutlineRoundedIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                </Stack>
            </CardActionArea>
        </Card>
    );
};

const AddRundown: React.FC<{ onCreate: (name: string) => void; onCancel: () => void }> = ({onCreate, onCancel}) => {
    const {t} = useTranslation('common');
    const [name, setName] = useState('');
    const trimmed = name.trim();

    return (
        <>
            <Typography variant="h3">{t('playPage.newRundown')}</Typography>
            <TextField
                label={t('playPage.nameLabel')}
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && trimmed) onCreate(trimmed);
                }}
            />

            <RundownEditorActionBar
                onCancel={onCancel}
                onSave={() => trimmed && onCreate(trimmed)}
            />
        </>
    );
};

interface RenameRundownProps {
    rundown: Rundown;
    onUpdate: (rundown: Rundown) => void;
    onCancel: () => void;
}

const RenameRundown: React.FC<RenameRundownProps> = ({rundown, onUpdate, onCancel}) => {
    const {t} = useTranslation('common');
    const [name, setName] = useState(rundown.name);
    const canSave = name.trim().length > 0 && name.trim() !== rundown.name;

    return (
        <>
            <Typography variant="h3">{t('playPage.renameRundown')}</Typography>
            <TextField
                label={t('playPage.nameLabel')}
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && canSave) onUpdate({...rundown, name: name.trim()});
                }}
            />

            <RundownEditorActionBar
                onCancel={onCancel}
                onSave={() => canSave && onUpdate({...rundown, name: name.trim()})}
            />
        </>
    );
};

interface ModalShellProps {
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
}

const ModalShell: React.FC<ModalShellProps> = ({open, onClose, children}) => (
    <Modal open={open} onClose={onClose}>
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
                    borderRadius: 2,
                    width: 500,
                    boxShadow: 8,
                })}
            >
                {children}
            </Stack>
        </Stack>
    </Modal>
);

const Page = () => {
    const {t} = useTranslation('common');
    const router = useRouter();
    const { rundowns, updateRundown, deleteRundown, createRundown } = useRundowns();

    const [editing, setEditing] = useState<Rundown | null>(null);
    const [adding, setAdding] = useState(false);
    const [deleting, setDeleting] = useState<Rundown | null>(null);

    return (
        <DefaultContentLayout>
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={2} mb={4}>
                <Stack spacing={1}>
                    <Typography variant="h1">{t('playPage.title')}</Typography>
                    <Typography variant="body1" sx={{color: 'text.secondary'}}>
                        {t('playPage.description')}
                    </Typography>
                </Stack>
                <Button
                    variant="contained"
                    startIcon={<AddRoundedIcon />}
                    onClick={() => setAdding(true)}
                >
                    {t('playPage.newRundown')}
                </Button>
            </Stack>

            {rundowns.length === 0 ? (
                <Card sx={{p: 3, textAlign: 'center', maxWidth: 720}}>
                    <Typography variant="body1" sx={{color: 'text.secondary'}}>
                        {t('playPage.emptyBefore')}
                        <strong>{t('playPage.newRundown')}</strong>
                        {t('playPage.emptyAfter')}
                    </Typography>
                </Card>
            ) : (
                <Stack spacing={1.5} sx={{maxWidth: 820}}>
                    {rundowns.map(rundown => (
                        <RundownCard
                            key={rundown.id}
                            rundown={rundown}
                            onOpen={() => router.push(`/play/${rundown.id}`)}
                            onEdit={() => setEditing(rundown)}
                            onDelete={() => setDeleting(rundown)}
                        />
                    ))}
                </Stack>
            )}

            <ModalShell open={editing !== null} onClose={() => setEditing(null)}>
                {editing && (
                    <RenameRundown
                        rundown={editing}
                        onUpdate={(entry) => { updateRundown(entry); setEditing(null); }}
                        onCancel={() => setEditing(null)}
                    />
                )}
            </ModalShell>

            <ModalShell open={adding} onClose={() => setAdding(false)}>
                <AddRundown
                    onCreate={name => { setAdding(false); createRundown(name); }}
                    onCancel={() => setAdding(false)}
                />
            </ModalShell>

            <Modal open={deleting !== null} onClose={() => setDeleting(null)}>
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
                        sx={(theme) => ({
                            p: 3,
                            width: 460,
                            bgcolor: theme.palette.surface.elevated,
                            border: `1px solid ${theme.palette.divider}`,
                        })}
                    >
                        <Stack spacing={2}>
                            <Stack direction="row" alignItems="center" gap={1.5}>
                                <WarningAmberRoundedIcon sx={{color: '#e88c8c'}} />
                                <Typography variant="h3">{t('playPage.deleteDialog.title')}</Typography>
                            </Stack>
                            <Typography variant="body1" sx={{color: 'text.secondary'}}>
                                <strong style={{color: 'inherit'}}>{deleting?.name}</strong>
                                {' '}
                                {t('playPage.deleteDialog.bodyAfterName')}
                            </Typography>
                            <Stack direction="row" justifyContent="flex-end" gap={1}>
                                <Button color="inherit" onClick={() => setDeleting(null)}>
                                    {t('actions.cancel')}
                                </Button>
                                <Button
                                    variant="contained"
                                    color="error"
                                    onClick={() => {
                                        if (deleting) deleteRundown(deleting);
                                        setDeleting(null);
                                    }}
                                >
                                    {t('actions.delete')}
                                </Button>
                            </Stack>
                        </Stack>
                    </Card>
                </Stack>
            </Modal>
        </DefaultContentLayout>
    );
};

export default Page;

interface EditRundownProps {
    rundown: Rundown;
    onUpdate: (rundown: Rundown) => void;
    onDelete: () => void;
    onCancel: () => void;
}

// QuickActions still drives delete from inside this dialog rather than from
// a per-card icon. Kept as a separate export so the new rundown card UX
// (split rename / delete) doesn't bleed into the quick-actions modal.
export const EditRundown: React.FC<EditRundownProps> = ({rundown, onUpdate, onDelete, onCancel}) => {
    const {t} = useTranslation('common');
    const [name, setName] = useState(rundown.name);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const canSave = name.trim().length > 0 && name.trim() !== rundown.name;

    return (
        <>
            <Typography variant="h3">{t('playPage.renameRundown')}</Typography>
            <TextField
                label={t('playPage.nameLabel')}
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && canSave) onUpdate({...rundown, name: name.trim()});
                }}
            />

            <RundownEditorActionBar
                onCancel={onCancel}
                onSave={() => canSave && onUpdate({...rundown, name: name.trim()})}
                onDelete={() => setConfirmingDelete(true)}
            />

            <Modal open={confirmingDelete} onClose={() => setConfirmingDelete(false)}>
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
                            bgcolor: theme.palette.surface.raised,
                            border: `1px solid ${theme.palette.divider}`,
                            borderRadius: 1.5,
                            width: 460,
                        })}
                    >
                        <Stack direction="row" alignItems="center" gap={1.5}>
                            <WarningAmberRoundedIcon sx={{color: '#e88c8c'}} />
                            <Typography variant="h3">{t('playPage.deleteDialog.titleAlt')}</Typography>
                        </Stack>
                        <Typography variant="body2" sx={{color: 'text.secondary'}}>
                            <strong style={{color: 'inherit'}}>{rundown.name}</strong>
                            {' '}
                            {t('playPage.deleteDialog.bodyAfterName')}
                        </Typography>
                        <Stack direction="row" justifyContent="flex-end" gap={1}>
                            <Button color="inherit" onClick={() => setConfirmingDelete(false)}>
                                {t('actions.cancel')}
                            </Button>
                            <Button
                                variant="contained"
                                color="error"
                                onClick={() => { setConfirmingDelete(false); onDelete(); }}
                            >
                                {t('actions.delete')}
                            </Button>
                        </Stack>
                    </Stack>
                </Stack>
            </Modal>
        </>
    );
};
