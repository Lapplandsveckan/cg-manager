import { noTryAsync } from 'no-try';
import { type ManagerApi } from '../api/api';
import { type MediaDoc } from '../api/caspar';

type Severity = 'info' | 'warning' | 'error' | 'success';

interface MediaHandlersConfig {
    socket: ManagerApi | null;
    path: string;
    t: (key: string) => string;
    setBusy: (busy: boolean) => void;
    setError: (error: string | null) => void;
    notify: (text: string, severity?: Severity) => void;
}

export const createMediaHandlers = (config: MediaHandlersConfig) => {
    const { socket, path, t, setBusy, setError, notify } = config;

    const confirmDelete = async (
        deleting: MediaDoc | null,
        onSuccess: () => void,
    ) => {
        if (!deleting || !socket) return;
        setBusy(true);
        setError(null);
        const [err] = await noTryAsync(() =>
            socket.caspar.deleteMedia(deleting.id),
        );
        if (err)
            setError((err as Error)?.message ?? t('media.errors.deleteFailed'));
        else {
            notify(t('media.success.deleted'), 'success');
            onSuccess();
        }

        setBusy(false);
    };

    const confirmRename = async (
        renaming: MediaDoc | null,
        renameValue: string,
        onSuccess: () => void,
    ) => {
        if (!renaming || !socket) return;
        const next = renameValue.trim();
        const clipShortName = renaming.id.split('/').pop() ?? renaming.id;
        if (!next || next === clipShortName) {
            onSuccess();
            return;
        }
        setBusy(true);
        setError(null);
        const [err] = await noTryAsync(async () =>
            socket.caspar.renameMedia(renaming.id, next),
        );
        if (err)
            setError((err as Error)?.message ?? t('media.errors.renameFailed'));
        else {
            notify(t('media.success.renamed'), 'success');
            onSuccess();
        }

        setBusy(false);
    };

    const confirmRenameFolder = async (
        renamingFolder: string | null,
        folderRenameValue: string,
        onSuccess: () => void,
    ) => {
        if (!socket || !renamingFolder) return;
        const next = folderRenameValue.trim();
        if (!next || next === renamingFolder) {
            onSuccess();
            return;
        }
        setBusy(true);
        setError(null);
        const from = `${path}${renamingFolder}`;
        const to = `${path}${next}`;
        const [err] = await noTryAsync(() =>
            socket.caspar.renameFolder(from, to),
        );
        setBusy(false);
        if (err) {
            setError(
                (err as Error)?.message ?? t('media.errors.renameFolderFailed'),
            );
            return;
        }
        notify(t('media.success.folderRenamed'), 'success');
        onSuccess();
    };

    const confirmDeleteFolder = async (
        deletingFolder: string | null,
        onSuccess: () => void,
    ) => {
        if (!socket || !deletingFolder) return;
        setBusy(true);
        setError(null);
        const target = `${path}${deletingFolder}`;
        const [err] = await noTryAsync(() =>
            socket.caspar.deleteFolder(target),
        );
        setBusy(false);
        if (err) {
            setError(err.message ?? t('media.errors.deleteFolderFailed'));
            return;
        }
        notify(t('media.success.folderDeleted'), 'success');
        onSuccess();
    };

    const confirmCreateFolder = async (
        folderName: string,
        onSuccess: (newPath: string) => void,
    ) => {
        if (!socket) return;
        const name = folderName.trim();
        if (!name) return;
        setBusy(true);
        setError(null);
        const target = `${path}${name}`;
        const [err, res] = await noTryAsync(() =>
            socket.caspar.createFolder(target),
        );
        setBusy(false);
        if (err || !res) {
            setError(err?.message ?? t('media.errors.createFolderFailed'));
            return;
        }
        notify(t('media.success.folderCreated'), 'success');
        onSuccess(res.path);
    };

    return {
        confirmDelete,
        confirmRename,
        confirmRenameFolder,
        confirmDeleteFolder,
        confirmCreateFolder,
    };
};
