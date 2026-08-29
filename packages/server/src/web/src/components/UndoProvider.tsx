import React, { createContext, useContext } from 'react';
import { useConnection } from './ConnectionProvider';
import { useUndoActions } from '../lib/undo/useUndoActions';
import { useUndoReconnectClear } from '../lib/undo/useUndoReconnectClear';
import { useUndoKeyboardShortcuts } from '../lib/hooks/useUndoKeyboardShortcuts';

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

export const UndoProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const { state: connectionState } = useConnection();
    const { undo, redo, canUndo, canRedo, isBusy } = useUndoActions();

    useUndoReconnectClear(connectionState);
    useUndoKeyboardShortcuts(undo, redo);

    return (
        <UndoContext.Provider
            value={{
                undo: () => void undo(),
                redo: () => void redo(),
                canUndo,
                canRedo,
                isBusy,
            }}
        >
            {children}
        </UndoContext.Provider>
    );
};
