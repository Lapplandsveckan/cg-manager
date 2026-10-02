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
    danger?: boolean;
    divider?: boolean;
}

export type ContextMenuSurface = 'rundown-item' | 'media' | 'route' | 'plugin';

type AnyProvider = (
    target: unknown,
) => (ContextMenuItem | false | null | undefined)[];

// Items append after the host built-ins; falsy entries are filtered out
export type ContextMenuItemProvider<T = unknown> = (
    target: T,
) => (ContextMenuItem | false | null | undefined)[];

export interface ContextMenuMediaTarget {
    name: string;
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
    bind: (
        items: (ContextMenuItem | false | null | undefined)[],
    ) => (event: React.MouseEvent) => void;
    registerProvider: <T>(
        surface: ContextMenuSurface,
        provider: ContextMenuItemProvider<T>,
    ) => () => void;
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
