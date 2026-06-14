import { Button, Card, Stack, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { DefaultContentLayout } from '../../components/DefaultContentLayout';
import { useRundowns } from '../../hooks/useRundowns';
import { RundownCard } from '../../components/play/RundownCard';
import { AddRundownModal } from '../../components/play/AddRundownModal';
import { RenameRundownModal } from '../../components/play/RenameRundownModal';
import { DeleteRundownModal } from '../../components/play/DeleteRundownModal';
import { EditRundownModal } from '../../components/play/EditRundownModal';
import { ModalShell } from '../../components/play/ModalShell';
import type { Rundown, RundownItem } from '../../hooks/useRundowns';

export type { Rundown, RundownItem };

const Page = () => {
    const { t } = useTranslation('common');
    const router = useRouter();
    const { rundowns, updateRundown, deleteRundown, createRundown } =
        useRundowns();

    const [editing, setEditing] = useState<Rundown | null>(null);
    const [adding, setAdding] = useState(false);
    const [deleting, setDeleting] = useState<Rundown | null>(null);

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
                <Button
                    variant="contained"
                    startIcon={<AddRoundedIcon />}
                    onClick={() => setAdding(true)}
                >
                    {t('playPage.newRundown')}
                </Button>
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
                    rundowns.map(rundown => (
                        <RundownCard
                            key={rundown.id}
                            rundown={rundown}
                            onOpen={() => router.push(`/play/${rundown.id}`)}
                            onEdit={() => setEditing(rundown)}
                            onDelete={() => setDeleting(rundown)}
                        />
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
        </DefaultContentLayout>
    );
};

export default Page;

export { EditRundownModal as EditRundown };
