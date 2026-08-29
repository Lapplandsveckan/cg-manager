import { useEffect } from 'react';

function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    if (target instanceof HTMLInputElement) return true;
    if (target instanceof HTMLTextAreaElement) return true;
    return target.isContentEditable;
}

export function useUndoKeyboardShortcuts(
    undo: () => void,
    redo: () => void,
): void {
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
                redo();
                return;
            }
            if (isUndo) {
                e.preventDefault();
                undo();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [undo, redo]);
}
