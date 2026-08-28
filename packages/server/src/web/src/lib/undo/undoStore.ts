import {
    type BarrierEntry,
    type StackEntry,
    type UndoEntry,
    type UndoLabel,
    isBarrierEntry,
    scopeMatches,
} from './types';

const STACK_CAP = 50;

let undoStack: StackEntry[] = [];
let redoStack: UndoEntry[] = [];
const idAliases = new Map<string, string>();

type Subscriber = () => void;
const subscribers = new Set<Subscriber>();

function notify(): void {
    for (const sub of subscribers) sub();
}

export function subscribe(fn: Subscriber): () => void {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
}

function pushCapped<T>(stack: T[], entry: T): T[] {
    const next = [...stack, entry];
    return next.length > STACK_CAP ? next.slice(next.length - STACK_CAP) : next;
}

export function record<T>(entry: Omit<UndoEntry<T>, 'ts'>): void {
    if (Object.is(entry.prev, entry.next)) return;
    const full: UndoEntry = { ...entry, ts: Date.now() };
    undoStack = pushCapped(undoStack, full);
    redoStack = [];
    notify();
}

export function recordBarrier(
    label: UndoLabel,
    invalidateKeys: string[],
): void {
    const barrier: BarrierEntry = { kind: 'barrier', label, ts: Date.now() };
    undoStack = pushCapped(undoStack, barrier);
    redoStack = [];
    invalidate(invalidateKeys);
    notify();
}

function dropMatching(predicate: (scope: string) => boolean): void {
    let dropped = false;

    const filterStack = <T extends StackEntry>(stack: T[]): T[] =>
        stack.filter(entry => {
            if (isBarrierEntry(entry)) return true;
            const matches = entry.scopes.some(predicate);
            if (matches) dropped = true;
            return !matches;
        });

    undoStack = filterStack(undoStack);
    redoStack = filterStack(redoStack);

    if (dropped) notify();
}

export function invalidate(keys: string[]): void {
    dropMatching(scope => keys.some(key => scopeMatches(scope, key)));
}

export function liveId(id: string): string {
    const seen = new Set<string>();
    let current = id;
    while (idAliases.has(current) && !seen.has(current)) {
        seen.add(current);
        current = idAliases.get(current) as string;
    }
    return current;
}

export function aliasId(oldId: string, newId: string): void {
    if (oldId === newId) return;
    idAliases.set(oldId, newId);
}

export function rekeyScope(oldScope: string, newScope: string): void {
    const rekeyEntry = (entry: StackEntry): StackEntry => {
        if (isBarrierEntry(entry)) return entry;
        if (!entry.scopes.includes(oldScope)) return entry;
        return {
            ...entry,
            scopes: entry.scopes.map(scope =>
                scope === oldScope ? newScope : scope,
            ),
        };
    };

    undoStack = undoStack.map(rekeyEntry);
    redoStack = redoStack.map(rekeyEntry) as UndoEntry[];
    notify();
}

export function popUndo(): StackEntry | undefined {
    const entry = undoStack[undoStack.length - 1];
    if (entry === undefined) return undefined;
    undoStack = undoStack.slice(0, -1);
    notify();
    return entry;
}

export function popRedo(): UndoEntry | undefined {
    const entry = redoStack[redoStack.length - 1];
    if (entry === undefined) return undefined;
    redoStack = redoStack.slice(0, -1);
    notify();
    return entry;
}

export function pushUndo(entry: UndoEntry): void {
    undoStack = pushCapped(undoStack, entry);
    notify();
}

export function pushRedo(entry: UndoEntry): void {
    redoStack = pushCapped(redoStack, entry);
    notify();
}

export function clearAll(): void {
    idAliases.clear();
    if (!undoStack.length && !redoStack.length) return;
    undoStack = [];
    redoStack = [];
    notify();
}

export function getUndoStack(): readonly StackEntry[] {
    return undoStack;
}

export function getRedoStack(): readonly UndoEntry[] {
    return redoStack;
}
