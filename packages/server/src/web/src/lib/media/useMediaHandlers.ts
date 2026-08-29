import { useTranslation } from 'next-i18next';
import { useToast } from '../../components/ToastProvider';
import { RequestError } from '../api/api';
import { type MediaDoc } from '../api/caspar';
import { useSocket } from '../hooks/useSocket';
import { BulkDeleteError, useMediaMutations } from '../query/media';

export const useMediaHandlers = (path: string) => {
    const socket = useSocket();
    const { t } = useTranslation('common');
    const notify = useToast();
    const mutations = useMediaMutations();
    const {
        deleteMedia,
        deleteManyMedia,
        renameMedia,
        moveMedia,
        createFolder,
        deleteFolder,
        renameFolder,
    } = mutations;

    const all = Object.values(mutations);
    // moveMedia is excluded from busy (and error below): a drag-move runs
    // outside any modal, and busy disables the open modal's buttons.
    const modalMutations = [
        deleteMedia,
        deleteManyMedia,
        renameMedia,
        createFolder,
        deleteFolder,
        renameFolder,
    ];
    const busy = modalMutations.some(m => m.isPending);
    const clearError = () => all.forEach(m => m.reset());

    const messageOr = (error: Error | null, fallbackKey: string) =>
        error && (error.message || t(fallbackKey));

    const bulkMessage = (error: BulkDeleteError) =>
        error.failed === error.total
            ? t('media.errors.deleteFailed')
            : `${t('media.errors.deleteFailed')} (${error.failed})`;

    const error =
        messageOr(deleteMedia.error, 'media.errors.deleteFailed') ??
        (deleteManyMedia.error instanceof BulkDeleteError
            ? bulkMessage(deleteManyMedia.error)
            : messageOr(deleteManyMedia.error, 'media.errors.deleteFailed')) ??
        messageOr(renameMedia.error, 'media.errors.renameFailed') ??
        messageOr(renameFolder.error, 'media.errors.renameFolderFailed') ??
        messageOr(deleteFolder.error, 'media.errors.deleteFolderFailed') ??
        messageOr(createFolder.error, 'media.errors.createFolderFailed') ??
        null;

    const confirmDelete = (
        deleting: MediaDoc | null,
        onSuccess: () => void,
    ) => {
        if (!deleting || !socket) return;

        deleteMedia.mutate(deleting.id, {
            onSuccess: () => {
                notify(t('media.success.deleted'), 'success');
                onSuccess();
            },
        });
    };

    const confirmDeleteMany = (deleting: MediaDoc[], onSuccess: () => void) => {
        if (!deleting.length || !socket) return;

        deleteManyMedia.mutate(
            deleting.map(doc => doc.id),
            {
                onSuccess: () => {
                    notify(
                        t('media.success.filesDeleted', {
                            count: deleting.length,
                        }),
                        'success',
                    );
                    onSuccess();
                },
            },
        );
    };

    const confirmRename = (
        renaming: MediaDoc | null,
        renameValue: string,
        onSuccess: () => void,
    ) => {
        if (!renaming || !socket) return;

        const name = renameValue.trim();
        const shortName = renaming.id.split('/').pop() ?? renaming.id;
        if (!name || name === shortName) return onSuccess();

        renameMedia.mutate(
            { id: renaming.id, name },
            {
                onSuccess: () => {
                    notify(t('media.success.renamed'), 'success');
                    onSuccess();
                },
            },
        );
    };

    const confirmRenameFolder = (
        renamingFolder: string | null,
        folderRenameValue: string,
        onSuccess: () => void,
    ) => {
        if (!socket || !renamingFolder) return;

        const next = folderRenameValue.trim();
        if (!next || next === renamingFolder) return onSuccess();

        renameFolder.mutate(
            { from: `${path}${renamingFolder}`, to: `${path}${next}` },
            {
                onSuccess: () => {
                    notify(t('media.success.folderRenamed'), 'success');
                    onSuccess();
                },
            },
        );
    };

    const confirmDeleteFolder = (
        deletingFolder: string | null,
        recursive: boolean,
        onSuccess: () => void,
        onNotEmpty?: () => void,
    ) => {
        if (!socket || !deletingFolder) return;

        deleteFolder.mutate(
            { path: `${path}${deletingFolder}`, recursive },
            {
                onSuccess: () => {
                    notify(t('media.success.folderDeleted'), 'success');
                    onSuccess();
                },
                onError: err => {
                    const isNotEmpty =
                        !recursive &&
                        err instanceof RequestError &&
                        err.status === 409;
                    if (!isNotEmpty || !onNotEmpty) return;

                    // The 409 is flow control (switch the modal to
                    // recursive-confirm), not an error to display.
                    deleteFolder.reset();
                    onNotEmpty();
                },
            },
        );
    };

    const confirmCreateFolder = (
        folderName: string,
        onSuccess: (newPath: string) => void,
    ) => {
        if (!socket) return;

        const name = folderName.trim();
        if (!name) return;

        createFolder.mutate(`${path}${name}`, {
            onSuccess: res => {
                notify(t('media.success.folderCreated'), 'success');
                onSuccess(res.path);
            },
        });
    };

    const moveClip = (clipId: string, folderFullPath: string) => {
        if (!socket) return;

        const basename = clipId.split('/').pop();
        if (!basename) return;

        const to = folderFullPath ? `${folderFullPath}/${basename}` : basename;
        if (to === clipId) return;

        moveMedia.mutate(
            { from: clipId, to },
            {
                onSuccess: () => notify(t('media.success.moved'), 'success'),
                onError: err =>
                    notify(
                        err.message || t('media.errors.moveFailed'),
                        'error',
                    ),
            },
        );
    };

    return {
        busy,
        error,
        clearError,
        confirmDelete,
        confirmDeleteMany,
        confirmRename,
        confirmRenameFolder,
        confirmDeleteFolder,
        confirmCreateFolder,
        moveClip,
    };
};
