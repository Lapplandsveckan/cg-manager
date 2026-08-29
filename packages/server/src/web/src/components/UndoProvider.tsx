import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useSyncExternalStore,
} from 'react';
import { noTryAsync } from 'no-try';
import { useTranslation } from 'next-i18next';
import { useSocket } from '../lib/hooks/useSocket';
import { useConnection } from './ConnectionProvider';
import { useToast } from './ToastProvider';
import {
    clearAll,
    getRedoStack,
    getUndoStack,
    invalidate,
    popRedo,
    popUndo,
    pushRedo,
    pushUndo,
    subscribe,
} from '../lib/undo/undoStore';
import {
    isBarrierEntry,
    type UndoContext as UndoApplyContext,
    type UndoEntry,
    type UndoLabel,
} from '../lib/undo/types';
import { UndoStaleError, routeScope, rundownScope } from '../lib/undo/tools';
import { queryClient } from '../lib/query/client';
import { qm } from '../lib/query/keys';
import { defineMutation, useMutationSpec } from '../lib/query/mutations';
import { useWsBroadcast } from '../lib/query/useWsBroadcast';

interface UndoContextValue {
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    isBusy: boolean;
}

const UndoContext = createContext<UndoContextValue>({
    undo: () => undefined,
    redo: () => undefined,
    canUndo: false,
    canRedo: false,
    isBusy: false,
});

export const useUndo = (): UndoContextValue => useContext(UndoContext);

const MAX_UNDO_ATTEMPTS = 2;

interface RunEntryVars {
    entry: UndoEntry;
    direction: UndoApplyContext['direction'];
}

const runUndoEntry = defineMutation({
    key: qm.undo,
    run: (api, { entry, direction }: RunEntryVars) =>
        Promise.resolve(
            entry.apply(direction === 'undo' ? entry.prev : entry.next, {
                api,
                direction,
                entry,
            }),
        ),
});

function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    if (target instanceof HTMLInputElement) return true;
    if (target instanceof HTMLTextAreaElement) return true;
    return target.isContentEditable;
}

export const UndoProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const { t } = useTranslation('common');
    const conn = useSocket();
    const notify = useToast();
    const { state: connectionState } = useConnection();
    const runEntry = useMutationSpec(runUndoEntry);

    const undoStack = useSyncExternalStore(
        subscribe,
        getUndoStack,
        getUndoStack,
    );
    const redoStack = useSyncExternalStore(
        subscribe,
        getRedoStack,
        getRedoStack,
    );

    const labelText = useCallback(
        (label: UndoLabel) => {
            if (label.text !== undefined) return label.text;
            if (typeof label.key !== 'string' || !label.key)
                return t('undo.labels.unknown');
            if (label.key.includes(':')) return t(label.key, label.params);
            return t(`undo.labels.${label.key}`, label.params);
        },
        [t],
    );

    const undo = useCallback(async () => {
        // Synchronous re-entrancy guard — the mutation cache updates
        // synchronously on `mutateAsync`, unlike `isPending` (a render-time
        // value), so two Cmd+Z presses in one tick still can't overlap.
        if (queryClient.isMutating({ mutationKey: qm.undo })) return;
        const entry = popUndo();
        if (!entry) {
            notify(t('undo.nothingToUndo'), 'info');
            return;
        }
        if (isBarrierEntry(entry)) {
            notify(
                t('undo.barrier', { label: labelText(entry.label) }),
                'warning',
            );
            return;
        }

        const [err] = await noTryAsync(() =>
            runEntry.mutateAsync({ entry, direction: 'undo' }),
        );

        if (!err) {
            pushRedo(entry.failCount ? { ...entry, failCount: 0 } : entry);
            notify(
                t('undo.undid', { label: labelText(entry.label) }),
                'success',
            );
            return;
        }
        if (err instanceof UndoStaleError) {
            notify(t('undo.stale'), 'warning');
            return;
        }
        const failCount = (entry.failCount ?? 0) + 1;
        if (failCount >= MAX_UNDO_ATTEMPTS) {
            notify(t('undo.errors.undoFailedDropped'), 'error');
            return;
        }
        pushUndo({ ...entry, failCount });
        notify(t('undo.errors.undoFailed'), 'error');
    }, [notify, t, labelText, runEntry.mutateAsync]);

    const redo = useCallback(async () => {
        if (queryClient.isMutating({ mutationKey: qm.undo })) return;
        const entry = popRedo();
        if (!entry) {
            notify(t('undo.nothingToRedo'), 'info');
            return;
        }

        const [err] = await noTryAsync(() =>
            runEntry.mutateAsync({ entry, direction: 'redo' }),
        );

        if (!err) {
            pushUndo(entry.failCount ? { ...entry, failCount: 0 } : entry);
            notify(
                t('undo.redid', { label: labelText(entry.label) }),
                'success',
            );
            return;
        }
        const failCount = (entry.failCount ?? 0) + 1;
        if (failCount >= MAX_UNDO_ATTEMPTS) {
            notify(t('undo.errors.redoFailedDropped'), 'error');
            return;
        }
        pushRedo({ ...entry, failCount });
        notify(t('undo.errors.redoFailed'), 'error');
    }, [notify, t, labelText, runEntry.mutateAsync]);

    const wasConnectedRef = useRef(connectionState === 'connected');
    useEffect(() => {
        const reconnected =
            connectionState === 'connected' && !wasConnectedRef.current;
        wasConnectedRef.current = connectionState === 'connected';
        if (reconnected) clearAll();
    }, [connectionState]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (isEditableTarget(e.target)) return;
            const mod = e.metaKey || e.ctrlKey;
            if (!mod) return;

            const key = e.key.toLowerCase();
            const isRedo =
                (key === 'z' && e.shiftKey) || (key === 'y' && e.ctrlKey);
            const isUndo = key === 'z' && !e.shiftKey;

            if (isRedo) {
                e.preventDefault();
                void redo();
                return;
            }
            if (isUndo) {
                e.preventDefault();
                void undo();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [undo, redo]);

    useWsBroadcast(conn, 'rundown/entry', 'UPDATE', data => {
        const { id, entry } = data as { id: string; entry: unknown };
        const entries = Array.isArray(entry) ? entry : [entry];
        invalidate(
            entries
                .filter((e): e is { id: string } =>
                    Boolean((e as { id?: string })?.id),
                )
                .map(e => rundownScope(id, `entry:${e.id}`)),
        );
    });

    useWsBroadcast(conn, 'rundown/entry', 'DELETE', data => {
        const { id, entry } = data as { id: string; entry: string };
        invalidate([rundownScope(id, `entry:${entry}`)]);
    });

    useWsBroadcast(conn, 'rundown/order', 'ACTION', data => {
        const { id } = data as { id: string };
        invalidate([rundownScope(id, 'order')]);
    });

    useWsBroadcast(conn, 'rundown', 'UPDATE', data => {
        const { id } = data as { id: string };
        invalidate([rundownScope(id, 'name')]);
    });

    useWsBroadcast(conn, 'rundown', 'DELETE', data => {
        if (typeof data === 'string') invalidate([rundownScope(data)]);
    });

    useWsBroadcast(conn, 'routes', 'UPDATE', data => {
        const route = data as { id?: string };
        if (!route?.id) return;
        invalidate([routeScope(route.id)]);
    });

    useWsBroadcast(conn, 'routes', 'DELETE', data => {
        if (typeof data !== 'string') return;
        invalidate([routeScope(data)]);
    });

    return (
        <UndoContext.Provider
            value={{
                undo: () => void undo(),
                redo: () => void redo(),
                canUndo: undoStack.length > 0,
                canRedo: redoStack.length > 0,
                isBusy: runEntry.isPending,
            }}
        >
            {children}
        </UndoContext.Provider>
    );
};
