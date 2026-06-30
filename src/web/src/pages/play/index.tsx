import {
    Button,
    Card,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { DefaultContentLayout } from '../../components/DefaultContentLayout';
import { useRundowns } from '../../hooks/useRundowns';
import { RundownCard } from '../../components/play/RundownCard';
import { SlotErrorBoundary } from '../../components/SlotErrorBoundary';
import { AddRundownModal } from '../../components/play/AddRundownModal';
import { RenameRundownModal } from '../../components/play/RenameRundownModal';
import { DeleteRundownModal } from '../../components/play/DeleteRundownModal';
import { EditRundownModal } from '../../components/play/EditRundownModal';
import { ModalShell } from '../../components/play/ModalShell';
import { QuickJumpPalette } from '../../components/play/QuickJumpPalette';
import type { Rundown, RundownItem } from '../../hooks/useRundowns';

export type { Rundown, RundownItem };

type SortKey =
    | 'default'
    | 'name-asc'
    | 'name-desc'
    | 'items-desc'
    | 'items-asc'
    | 'created-desc'
    | 'created-asc';

// Rundowns with no createdAt yet (just created, not written to disk) sort
// after everything else regardless of direction — there's nothing to compare.
function compareCreatedAt(a: Rundown, b: Rundown, desc: boolean): number {
    if (a.createdAt == null && b.createdAt == null) return 0;
    if (a.createdAt == null) return 1;
    if (b.createdAt == null) return -1;
    return desc ? b.createdAt - a.createdAt : a.createdAt - b.createdAt;
}

function sortRundowns(rundowns: Rundown[], sortBy: SortKey): Rundown[] {
    if (sortBy === 'default') return rundowns;
    const sorted = [...rundowns];
    switch (sortBy) {
        case 'name-asc':
            return sorted.sort((a, b) => a.name.localeCompare(b.name));
        case 'name-desc':
            return sorted.sort((a, b) => b.name.localeCompare(a.name));
        case 'items-desc':
            return sorted.sort(
                (a, b) => (b.items?.length ?? 0) - (a.items?.length ?? 0),
            );
        case 'items-asc':
            return sorted.sort(
                (a, b) => (a.items?.length ?? 0) - (b.items?.length ?? 0),
            );
        case 'created-desc':
            return sorted.sort((a, b) => compareCreatedAt(a, b, true));
        case 'created-asc':
            return sorted.sort((a, b) => compareCreatedAt(a, b, false));
        default:
            return sorted;
    }
}

const Page = () => {
    const { t } = useTranslation('common');
    const router = useRouter();
    const { rundowns, updateRundown, deleteRundown, createRundown } =
        useRundowns();

    const [editing, setEditing] = useState<Rundown | null>(null);
    const [adding, setAdding] = useState(false);
    const [deleting, setDeleting] = useState<Rundown | null>(null);
    const [sortBy, setSortBy] = useState<SortKey>('default');
    const [jumpOpen, setJumpOpen] = useState(false);

    const sortedRundowns = useMemo(
        () => sortRundowns(rundowns, sortBy),
        [rundowns, sortBy],
    );

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setJumpOpen(true);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

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
                    <Typography variant="h1">{t('playPage.title')}</Typography>
                    <Typography
                        variant="body1"
                        sx={{ color: 'text.secondary' }}
                    >
                        {t('playPage.description')}
                    </Typography>
                </Stack>
                <Stack direction="row" alignItems="center" gap={1.5}>
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                        <InputLabel id="rundown-sort-label">
                            {t('playPage.sort.label')}
                        </InputLabel>
                        <Select
                            labelId="rundown-sort-label"
                            label={t('playPage.sort.label')}
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value as SortKey)}
                        >
                            <MenuItem value="default">
                                {t('playPage.sort.default')}
                            </MenuItem>
                            <MenuItem value="name-asc">
                                {t('playPage.sort.nameAsc')}
                            </MenuItem>
                            <MenuItem value="name-desc">
                                {t('playPage.sort.nameDesc')}
                            </MenuItem>
                            <MenuItem value="items-desc">
                                {t('playPage.sort.itemsDesc')}
                            </MenuItem>
                            <MenuItem value="items-asc">
                                {t('playPage.sort.itemsAsc')}
                            </MenuItem>
                            <MenuItem value="created-desc">
                                {t('playPage.sort.createdDesc')}
                            </MenuItem>
                            <MenuItem value="created-asc">
                                {t('playPage.sort.createdAsc')}
                            </MenuItem>
                        </Select>
                    </FormControl>
                    <Button
                        variant="outlined"
                        startIcon={<SearchRoundedIcon />}
                        onClick={() => setJumpOpen(true)}
                    >
                        {t('playPage.quickJump.hint')}
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<AddRoundedIcon />}
                        onClick={() => setAdding(true)}
                    >
                        {t('playPage.newRundown')}
                    </Button>
                </Stack>
            </Stack>

            <Stack spacing={1.5} sx={{ maxWidth: 820 }}>
                {rundowns.length === 0 ? (
                    <Card sx={{ p: 3, textAlign: 'center', maxWidth: 720 }}>
                        <Typography
                            variant="body1"
                            sx={{ color: 'text.secondary' }}
                        >
                            {t('playPage.emptyBefore')}
                            <strong>{t('playPage.newRundown')}</strong>
                            {t('playPage.emptyAfter')}
                        </Typography>
                    </Card>
                ) : (
                    sortedRundowns.map(rundown => (
                        <SlotErrorBoundary
                            key={rundown.id}
                            label={`rundown-card:${rundown.id}`}
                            resetKeys={[rundown.id]}
                        >
                            <RundownCard
                                rundown={rundown}
                                onOpen={() =>
                                    router.push(`/play/${rundown.id}`)
                                }
                                onEdit={() => setEditing(rundown)}
                                onDelete={() => setDeleting(rundown)}
                                onDuplicate={() =>
                                    createRundown(`${rundown.name} (copy)`)
                                }
                            />
                        </SlotErrorBoundary>
                    ))
                )}
            </Stack>

            <ModalShell
                open={editing !== null}
                onClose={() => setEditing(null)}
            >
                {editing && (
                    <RenameRundownModal
                        rundown={editing}
                        onUpdate={entry => {
                            updateRundown(entry);
                            setEditing(null);
                        }}
                        onCancel={() => setEditing(null)}
                    />
                )}
            </ModalShell>

            <ModalShell open={adding} onClose={() => setAdding(false)}>
                {adding && (
                    <AddRundownModal
                        onCreate={name => {
                            setAdding(false);
                            createRundown(name).then(data =>
                                router.push(`/play/${data.id}`),
                            );
                        }}
                        onCancel={() => setAdding(false)}
                    />
                )}
            </ModalShell>

            <DeleteRundownModal
                open={deleting !== null}
                rundown={deleting}
                onConfirm={rundown => {
                    deleteRundown(rundown);
                    setDeleting(null);
                }}
                onCancel={() => setDeleting(null)}
            />

            <SlotErrorBoundary label="quick-jump" silent>
                <QuickJumpPalette
                    rundowns={sortedRundowns}
                    open={jumpOpen}
                    onClose={() => setJumpOpen(false)}
                    onSelect={id => {
                        setJumpOpen(false);
                        router.push(`/play/${id}`);
                    }}
                />
            </SlotErrorBoundary>
        </DefaultContentLayout>
    );
};

export default Page;

export { EditRundownModal as EditRundown };
