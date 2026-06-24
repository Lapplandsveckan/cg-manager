import React, { createContext, useCallback, useContext, useState } from 'react';
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
}

interface MenuState {
    position: { top: number; left: number };
    items: ContextMenuItem[];
}

const ContextMenuContext = createContext<ContextMenuApi>({
    openMenu: () => undefined,
    bind: () => () => undefined,
});

export const useContextMenu = (): ContextMenuApi =>
    useContext(ContextMenuContext);

export const ContextMenuProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [state, setState] = useState<MenuState | null>(null);

    const openMenu = useCallback<OpenMenuFn>((event, items) => {
        event.preventDefault();
        event.stopPropagation();
        const resolved = items.filter(Boolean) as ContextMenuItem[];
        if (resolved.length === 0) return;
        setState({
            position: { top: event.clientY, left: event.clientX },
            items: resolved,
        });
    }, []);

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
        <ContextMenuContext.Provider value={{ openMenu, bind }}>
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
