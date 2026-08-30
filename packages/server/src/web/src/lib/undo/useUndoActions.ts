import { useCallback, useSyncExternalStore } from 'react';
import { noTryAsync } from 'no-try';
import { useTranslation } from 'next-i18next/pages';
import { useToast } from '../../components/ToastProvider';
import {
    getRedoStack,
    getUndoStack,
    popRedo,
    popUndo,
    pushRedo,
    pushUndo,
    subscribe,
} from './undoStore';
import {
    isBarrierEntry,
    type UndoContext as UndoApplyContext,
    type UndoEntry,
} from './types';
import { UndoStaleError } from './tools';
import { useUndoLabel } from './useUndoLabel';
import { queryClient } from '../query/client';
import { qm } from '../query/keys';
import { defineMutation, useMutationSpec } from '../query/mutations';

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

interface UndoActions {
    undo: () => Promise<void>;
    redo: () => Promise<void>;
    canUndo: boolean;
    canRedo: boolean;
    isBusy: boolean;
}

interface SharedDeps {
    t: ReturnType<typeof useTranslation>['t'];
    notify: ReturnType<typeof useToast>;
    labelText: ReturnType<typeof useUndoLabel>;
    mutateAsync: (vars: RunEntryVars) => Promise<unknown>;
}

interface DirectionLabels {
    done: string;
    failed: string;
    dropped: string;
}

interface ApplyConfig {
    direction: UndoApplyContext['direction'];
    labels: DirectionLabels;
    pushOnSuccess: (entry: UndoEntry) => void;
    pushOnRetry: (entry: UndoEntry) => void;
    // Lets undo intercept UndoStaleError before the generic retry logic.
    // Returning true means the error is fully handled — no retry, no dropped notice.
    onError?: (err: Error) => boolean;
}

/** Runs the mutation for one entry and handles the shared success/retry
 *  bookkeeping. Direction-specific stack wiring and copy come from `config`. */
function useApplyEntry({
    t,
    notify,
    labelText,
    mutateAsync,
}: SharedDeps): (entry: UndoEntry, config: ApplyConfig) => Promise<void> {
    return useCallback(
        async (entry, config) => {
            const [err] = await noTryAsync(() =>
                mutateAsync({ entry, direction: config.direction }),
            );

            if (!err) {
                config.pushOnSuccess(
                    entry.failCount ? { ...entry, failCount: 0 } : entry,
                );
                notify(
                    t(config.labels.done, { label: labelText(entry.label) }),
                    'success',
                );
                return;
            }

            if (config.onError?.(err)) return;

            const failCount = (entry.failCount ?? 0) + 1;
            if (failCount >= MAX_UNDO_ATTEMPTS) {
                notify(t(config.labels.dropped), 'error');
                return;
            }
            config.pushOnRetry({ ...entry, failCount });
            notify(t(config.labels.failed), 'error');
        },
        [mutateAsync, notify, t, labelText],
    );
}

const UNDO_LABELS: DirectionLabels = {
    done: 'undo.undid',
    failed: 'undo.errors.undoFailed',
    dropped: 'undo.errors.undoFailedDropped',
};

function useUndoRunner(deps: SharedDeps): () => Promise<void> {
    const { t, notify, labelText } = deps;
    const applyEntry = useApplyEntry(deps);

    return useCallback(async () => {
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

        await applyEntry(entry, {
            direction: 'undo',
            labels: UNDO_LABELS,
            pushOnSuccess: pushRedo,
            pushOnRetry: pushUndo,
            onError: err => {
                if (!(err instanceof UndoStaleError)) return false;
                notify(t('undo.stale'), 'warning');
                return true;
            },
        });
    }, [applyEntry, notify, t, labelText]);
}

const REDO_LABELS: DirectionLabels = {
    done: 'undo.redid',
    failed: 'undo.errors.redoFailed',
    dropped: 'undo.errors.redoFailedDropped',
};

function useRedoRunner(deps: SharedDeps): () => Promise<void> {
    const { t, notify } = deps;
    const applyEntry = useApplyEntry(deps);

    return useCallback(async () => {
        if (queryClient.isMutating({ mutationKey: qm.undo })) return;

        const entry = popRedo();
        if (!entry) {
            notify(t('undo.nothingToRedo'), 'info');
            return;
        }

        await applyEntry(entry, {
            direction: 'redo',
            labels: REDO_LABELS,
            pushOnSuccess: pushUndo,
            pushOnRetry: pushRedo,
        });
    }, [applyEntry, notify, t]);
}

export function useUndoActions(): UndoActions {
    const { t } = useTranslation('common');
    const notify = useToast();
    const labelText = useUndoLabel();
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

    const deps: SharedDeps = {
        t,
        notify,
        labelText,
        mutateAsync: runEntry.mutateAsync,
    };
    const undo = useUndoRunner(deps);
    const redo = useRedoRunner(deps);

    return {
        undo,
        redo,
        canUndo: undoStack.length > 0,
        canRedo: redoStack.length > 0,
        isBusy: runEntry.isPending,
    };
}
