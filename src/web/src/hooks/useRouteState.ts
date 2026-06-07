import { useCallback, useState } from 'react';
import { noTryAsync } from 'no-try';
import type { VideoRoute } from '../lib/api/videoRoutes';
import { useSocket } from '../lib/hooks/useSocket';

export const useRouteState = () => {
    const socket = useSocket();
    const [routes, setRoutes] = useState<VideoRoute[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<VideoRoute | null>(null);
    const [busy, setBusy] = useState(false);
    const [editing, setEditing] = useState<VideoRoute | null>(null);
    const [newType, setNewType] = useState<any>(null);

    const toggle = useCallback(
        async (id: string, next: boolean) => {
            if (!socket) return;
            setRoutes(
                prev =>
                    prev?.map(r =>
                        r.id === id ? { ...r, enabled: next } : r,
                    ) ?? prev,
            );
            const [err, updated] = await noTryAsync(async () =>
                socket.videoRoutes.setEnabled(id, next),
            );
            if (err) {
                setRoutes(
                    prev =>
                        prev?.map(r =>
                            r.id === id ? { ...r, enabled: !next } : r,
                        ) ?? prev,
                );
                setError((err as Error)?.message ?? 'Failed to toggle route');
                return;
            }

            setRoutes(
                prev => prev?.map(r => (r.id === id ? updated : r)) ?? prev,
            );
        },
        [socket],
    );

    const confirmDelete = async () => {
        if (!socket || !deleting) return;
        setBusy(true);
        setError(null);

        const [err] = await noTryAsync(async () =>
            socket.videoRoutes.delete(deleting.id),
        );
        if (err) {
            setError((err as Error)?.message ?? 'Failed to delete route');
        } else {
            setRoutes(prev => prev?.filter(r => r.id !== deleting.id) ?? prev);
            setDeleting(null);
        }

        setBusy(false);
    };

    const saveRoute = async (data: Omit<VideoRoute, 'id'>) => {
        if (!socket) return;
        if (editing) {
            const updated = await socket.videoRoutes.update(editing.id, data);
            setRoutes(
                prev =>
                    prev?.map(r => (r.id === updated.id ? updated : r)) ?? prev,
            );
        } else {
            const created = await socket.videoRoutes.create(data);
            setRoutes(prev => (prev ? [...prev, created] : [created]));
        }
        setEditing(null);
        setNewType(null);
    };

    return {
        routes,
        setRoutes,
        error,
        setError,
        deleting,
        setDeleting,
        busy,
        setBusy,
        editing,
        setEditing,
        newType,
        setNewType,
        toggle,
        confirmDelete,
        saveRoute,
    };
};
