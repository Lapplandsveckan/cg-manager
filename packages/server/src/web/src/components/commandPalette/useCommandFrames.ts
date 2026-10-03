import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react';
import { noTry } from 'no-try';
import type { CommandRegistry } from './registry';
import {
    compact,
    isParent,
    isPrompt,
    type Command,
    type CommandItem,
    type NestedCommand,
} from './types';

interface Resolved {
    items: Command[];
    loading: boolean;
    error: string | null;
}

const loadingState: Resolved = { items: [], loading: true, error: null };

const isNested = (command: Command): command is NestedCommand =>
    isParent(command) || isPrompt(command);

const done = (items: CommandItem[]): Resolved => ({
    items: compact(items),
    loading: false,
    error: null,
});

const toError = (reason: unknown): Error =>
    reason instanceof Error ? reason : new Error(String(reason));

const failed = (error: Error): Resolved => ({
    items: [],
    loading: false,
    error: error.message,
});

export function useCommandFrames(registry: CommandRegistry, open: boolean) {
    const version = useSyncExternalStore(
        registry.subscribe,
        registry.getVersion,
        registry.getVersion,
    );
    const [stack, setStack] = useState<NestedCommand[]>([]);
    const [resolved, setResolved] = useState<Resolved>(loadingState);
    const token = useRef(0);

    const rootItems = useMemo(
        () => registry.collect(),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [registry, open, version],
    );

    const rootId = stack[0]?.id;
    const liveRoot = rootItems.find(command => command.id === rootId);
    const freshRoot = liveRoot && isNested(liveRoot) ? liveRoot : stack[0];
    const top = stack.length === 1 ? freshRoot : stack[stack.length - 1];

    useEffect(() => {
        if (!open || !rootId) return;
        if (liveRoot) return;
        setStack([]);
    }, [open, rootId, liveRoot]);

    useEffect(() => {
        if (!open || !top || !isParent(top)) return;

        const mine = (token.current += 1);
        const settle = (next: Resolved) => {
            if (mine === token.current) setResolved(next);
        };
        const [error, result] = noTry(() => top.children());

        if (error) return void settle(failed(error));
        if (!(result instanceof Promise)) return void settle(done(result));

        setResolved(previous => ({ ...previous, loading: true }));
        result
            .then(items => settle(done(items)))
            .catch((reason: unknown) => settle(failed(toError(reason))));
    }, [open, top]);

    const push = useCallback((command: NestedCommand) => {
        setStack(previous => [...previous, command]);
        setResolved(loadingState);
    }, []);

    const popTo = useCallback((depth: number) => {
        setStack(previous => previous.slice(0, depth));
        setResolved(loadingState);
    }, []);

    const reset = useCallback((start?: NestedCommand) => {
        setStack(start ? [start] : []);
        setResolved(loadingState);
    }, []);

    const nestedItems = top && isParent(top) ? resolved.items : [];
    const items: Command[] = stack.length === 0 ? rootItems : nestedItems;
    const loading = Boolean(top && isParent(top) && resolved.loading);
    const error = top && isParent(top) ? resolved.error : null;

    return { stack, top, items, loading, error, push, popTo, reset };
}
