import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';
import {
    Divider,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
} from '@mui/material';

export interface ContextMenuItem {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
    disabled?: boolean;
    /** Renders the item in red — use for destructive actions like Delete. */
    danger?: boolean;
    /** Renders a Divider above this item. */
    divider?: boolean;
}

/** The four host surfaces that plugins can contribute items to. */
export type ContextMenuSurface = 'rundown-item' | 'media' | 'route' | 'plugin';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProvider = (
    target: any,
) => (ContextMenuItem | false | null | undefined)[];

/**
 * A function that receives the right-clicked target and returns context-menu
 * items to append after the host's built-in items. Falsy entries are filtered
 * out, so providers may conditionally return items with `cond && { ... }`.
 */
export type ContextMenuItemProvider<T = unknown> = (
    target: T,
) => (ContextMenuItem | false | null | undefined)[];

// Target descriptors for each surface — exported so plugin authors get types.

export interface ContextMenuMediaTarget {
    name: string;
    /** Full slash-separated media id, or null for folders / cards without dragId. */
    id: string | null;
    isFolder: boolean;
    duration?: number;
}

export interface ContextMenuRundownItemTarget {
    id: string;
    title: string;
    type?: string;
    data: unknown;
}

/** Mirrors the fields of VideoRoute relevant for context-menu decisions. */
export interface ContextMenuRouteTarget {
    id: string;
    name: string;
    enabled: boolean;
}

export interface ContextMenuPluginTarget {
    name: string;
    enabled: boolean;
    builtin: boolean;
    hasUi: boolean;
    minChannels: number;
}

type OpenMenuFn = (
    event: React.MouseEvent,
    items: (ContextMenuItem | false | null | undefined)[],
) => void;

interface ContextMenuApi {
    openMenu: OpenMenuFn;
    /** Convenience: returns an `onContextMenu` handler bound to the given items. */
    bind: (
        items: (ContextMenuItem | false | null | undefined)[],
    ) => (event: React.MouseEvent) => void;
    /**
     * Register a plugin provider for a surface. Returns an unsubscribe fn.
     * The provider is called with the right-clicked target and returns items
     * to append after the host's built-in items.
     */
    registerProvider: <T>(
        surface: ContextMenuSurface,
        provider: ContextMenuItemProvider<T>,
    ) => () => void;
    /**
     * Like `openMenu` but also calls all registered providers for `surface`
     * with `target`, appending their items after `hostItems`. Plugin items are
     * visually grouped with a divider.
     */
    openSurfaceMenu: <T>(
        event: React.MouseEvent,
        surface: ContextMenuSurface,
        target: T,
        hostItems: (ContextMenuItem | false | null | undefined)[],
    ) => void;
}

interface MenuState {
    position: { top: number; left: number };
    items: ContextMenuItem[];
}

const ContextMenuContext = createContext<ContextMenuApi>({
    openMenu: () => undefined,
    bind: () => () => undefined,
    registerProvider: () => () => undefined,
    openSurfaceMenu: () => undefined,
});

export const useContextMenu = (): ContextMenuApi =>
    useContext(ContextMenuContext);

/**
 * Hook for plugin-injected components. Call this once on mount to register a
 * provider that appends items to the given surface's context menu.
 *
 * The provider function does NOT need to be stable (memoized) — the hook
 * wraps it in a ref internally.
 *
 * @example
 * useRegisterContextMenuItems<ContextMenuRundownItemTarget>(
 *   'rundown-item',
 *   target => [
 *     { label: 'Send to ProPresenter', onClick: () => sendTo(target) },
 *   ],
 * );
 */
export const useRegisterContextMenuItems = <T,>(
    surface: ContextMenuSurface,
    provider: ContextMenuItemProvider<T>,
): void => {
    const { registerProvider } = useContextMenu();
    const ref = useRef(provider);
    ref.current = provider;

    useEffect(() => {
        const stable: ContextMenuItemProvider<T> = target =>
            ref.current(target);
        return registerProvider(surface, stable);
        // registerProvider is stable (useCallback); surface is a string constant.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [surface]);
};

export const ContextMenuProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [state, setState] = useState<MenuState | null>(null);
    const providers = useRef<Map<ContextMenuSurface, Set<AnyProvider>>>(
        new Map(),
    );

    const openItems = useCallback(
        (event: React.MouseEvent, items: ContextMenuItem[]) => {
            if (items.length === 0) return;
            setState({
                position: { top: event.clientY, left: event.clientX },
                items,
            });
        },
        [],
    );

    const openMenu = useCallback<OpenMenuFn>(
        (event, rawItems) => {
            event.preventDefault();
            event.stopPropagation();
            openItems(event, rawItems.filter(Boolean) as ContextMenuItem[]);
        },
        [openItems],
    );

    const registerProvider = useCallback(
        <T,>(
            surface: ContextMenuSurface,
            provider: ContextMenuItemProvider<T>,
        ): (() => void) => {
            if (!providers.current.has(surface))
                providers.current.set(surface, new Set());
            const set = providers.current.get(surface)!;
            set.add(provider as AnyProvider);
            return () => set.delete(provider as AnyProvider);
        },
        [],
    );

    const openSurfaceMenu = useCallback(
        <T,>(
            event: React.MouseEvent,
            surface: ContextMenuSurface,
            target: T,
            hostItems: (ContextMenuItem | false | null | undefined)[],
        ) => {
            event.preventDefault();
            event.stopPropagation();
            const host = hostItems.filter(Boolean) as ContextMenuItem[];

            const pluginItems: ContextMenuItem[] = [];
            for (const p of providers.current.get(surface) ?? []) {
                const contributed = p(target).filter(
                    Boolean,
                ) as ContextMenuItem[];
                pluginItems.push(...contributed);
            }

            // Mark the first plugin item with a divider to group them visually.
            if (pluginItems.length > 0 && host.length > 0) {
                pluginItems[0] = { ...pluginItems[0], divider: true };
            }

            openItems(event, [...host, ...pluginItems]);
        },
        [openItems],
    );

    const bind = useCallback(
        (items: (ContextMenuItem | false | null | undefined)[]) =>
            (event: React.MouseEvent) =>
                openMenu(event, items),
        [openMenu],
    );

    const close = () => setState(null);

    const run = (item: ContextMenuItem) => {
        close();
        item.onClick();
    };

    return (
        <ContextMenuContext.Provider
            value={{ openMenu, bind, registerProvider, openSurfaceMenu }}
        >
            {children}
            <Menu
                open={state !== null}
                onClose={close}
                anchorReference="anchorPosition"
                anchorPosition={state?.position}
                onContextMenu={e => e.preventDefault()}
            >
                {(state?.items ?? []).flatMap((item, i) => {
                    const nodes: React.ReactNode[] = [];
                    if (item.divider && i > 0) {
                        nodes.push(<Divider key={`d-${i}`} />);
                    }
                    nodes.push(
                        <MenuItem
                            key={`m-${i}`}
                            disabled={item.disabled}
                            onClick={() => run(item)}
                            sx={item.danger ? { color: '#e88c8c' } : undefined}
                        >
                            {item.icon && (
                                <ListItemIcon
                                    sx={
                                        item.danger
                                            ? { color: '#e88c8c' }
                                            : undefined
                                    }
                                >
                                    {item.icon}
                                </ListItemIcon>
                            )}
                            <ListItemText>{item.label}</ListItemText>
                        </MenuItem>,
                    );
                    return nodes;
                })}
            </Menu>
        </ContextMenuContext.Provider>
    );
};
