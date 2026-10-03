import { useState } from 'react';
import { noTryAsync } from 'no-try';
import { useTranslation } from 'react-i18next';
import {
    liveId,
    omitId,
    rekeyId,
    runMutation,
    useMutationSpec,
    useToast,
} from '@web-lib';
import type { VideoRoute } from './api';
import type { SourceType } from './components/RouteSourceTypePicker';
import { routeCreate, routeDelete, routeUpdate } from './query';
import { routeKey, routeScope, routeUndo } from './undo';

/**
 * Shared edit/create/delete flow for a `VideoRoute`, including undo
 * recording — used by both the full routes page and the rundown "Inspect
 * route" context-menu action.
 */
export function useRouteEditor() {
    const { t } = useTranslation('routes');
    const notify = useToast();
    const create = useMutationSpec(routeCreate);
    const update = useMutationSpec(routeUpdate);
    const deleteMut = useMutationSpec(routeDelete);

    const [editing, setEditing] = useState<VideoRoute | null>(null);
    const [newType, setNewType] = useState<SourceType | null>(null);
    const [deleting, setDeleting] = useState<VideoRoute | null>(null);

    const closeModal = () => {
        setEditing(null);
        setNewType(null);
    };

    const saveRoute = async (data: Omit<VideoRoute, 'id'>) => {
        const [err] = await noTryAsync(async () => {
            if (editing) {
                const before = editing;
                const updated = await update.mutateAsync({
                    id: editing.id,
                    data,
                });
                routeUndo.record({
                    label: {
                        key: 'routes:undo.update',
                        params: { name: updated.name },
                    },
                    scopes: [routeKey(updated.id)],
                    prev: before,
                    next: updated,
                    apply: (route, { api }) =>
                        runMutation(routeUpdate, api, {
                            id: liveId(updated.id),
                            data: omitId(route),
                        }),
                });
                return;
            }

            const created = await create.mutateAsync(data);
            routeUndo.record<VideoRoute | null>({
                label: {
                    key: 'routes:undo.create',
                    params: { name: created.name },
                },
                scopes: [routeKey(created.id)],
                prev: null,
                next: created,
                apply: async (route, { api, entry }) => {
                    if (route) {
                        const recreated = await runMutation(
                            routeCreate,
                            api,
                            omitId(route),
                        );
                        rekeyId(created.id, recreated.id, routeScope, entry);
                        return;
                    }
                    await runMutation(routeDelete, api, {
                        id: liveId(created.id),
                    });
                },
            });
        });
        if (err) {
            notify((err as Error)?.message ?? t('errors.saveFailed'), 'error');
            return;
        }
        notify(t('success.saved'), 'success');
        closeModal();
    };

    const confirmDelete = async () => {
        if (!deleting) return;

        const [err] = await noTryAsync(() =>
            deleteMut.mutateAsync({ id: deleting.id }),
        );
        if (err) {
            notify(
                (err as Error)?.message ?? t('errors.deleteFailed'),
                'error',
            );
            return;
        }

        const deleted = deleting;
        setDeleting(null);
        closeModal();
        notify(t('success.deleted'), 'success');
        routeUndo.record<VideoRoute | null>({
            label: {
                key: 'routes:undo.delete',
                params: { name: deleted.name },
            },
            scopes: [routeKey(deleted.id)],
            prev: deleted,
            next: null,
            apply: async (route, { api, entry }) => {
                if (route) {
                    const created = await runMutation(
                        routeCreate,
                        api,
                        omitId(route),
                    );
                    rekeyId(route.id, created.id, routeScope, entry);
                    return;
                }
                await runMutation(routeDelete, api, {
                    id: liveId(deleted.id),
                });
            },
        });
    };

    return {
        editing,
        setEditing,
        newType,
        setNewType,
        deleting,
        setDeleting,
        modalOpen: editing !== null || newType !== null,
        closeModal,
        saveRoute,
        confirmDelete,
        deleteBusy: deleteMut.isPending,
    };
}
