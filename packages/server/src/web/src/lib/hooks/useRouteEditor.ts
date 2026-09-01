import { useState } from 'react';
import { noTryAsync } from 'no-try';
import { useTranslation } from 'react-i18next';
import type { VideoRoute } from '../api/videoRoutes';
import type { SourceType } from '../../components/routes/RouteSourceTypePicker';
import { useToast } from '../../components/ToastProvider';
import { liveId, record } from '../undo/undoStore';
import { omitId, rekeyId, routeScope } from '../undo/tools';
import { runMutation, useMutationSpec } from '../query/mutations';
import { routeCreate, routeDelete, routeUpdate } from '../query/routes';

/**
 * Shared edit/create/delete flow for a `VideoRoute`, including undo
 * recording — used by both the full routes page and the rundown "Inspect
 * route" context-menu action.
 */
export function useRouteEditor() {
    const { t } = useTranslation('common');
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
                record({
                    label: {
                        key: 'routeUpdate',
                        params: { name: updated.name },
                    },
                    scopes: [routeScope(updated.id)],
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
            record<VideoRoute | null>({
                label: { key: 'routeCreate', params: { name: created.name } },
                scopes: [routeScope(created.id)],
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
            notify(
                (err as Error)?.message ?? t('videoRoutes.errors.saveFailed'),
                'error',
            );
            return;
        }
        notify(t('videoRoutes.success.saved'), 'success');
        closeModal();
    };

    const confirmDelete = async () => {
        if (!deleting) return;

        const [err] = await noTryAsync(() =>
            deleteMut.mutateAsync({ id: deleting.id }),
        );
        if (err) {
            notify(
                (err as Error)?.message ?? t('videoRoutes.errors.deleteFailed'),
                'error',
            );
            return;
        }

        const deleted = deleting;
        setDeleting(null);
        closeModal();
        notify(t('videoRoutes.success.deleted'), 'success');
        record<VideoRoute | null>({
            label: { key: 'routeDelete', params: { name: deleted.name } },
            scopes: [routeScope(deleted.id)],
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
