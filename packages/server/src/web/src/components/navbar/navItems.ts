import { type ParsedUrlQuery } from 'querystring';
import { type SvgIconTypeMap } from '@mui/material';
import { type OverridableComponent } from '@mui/material/OverridableComponent';
import { useEffect, useState } from 'react';
import ComputerIcon from '@mui/icons-material/Computer';
import ImageIcon from '@mui/icons-material/Image';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ExtensionIcon from '@mui/icons-material/Extension';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import TuneIcon from '@mui/icons-material/Tune';
import { useSocket } from '../../lib/hooks/useSocket';
import { UI_INJECTION_ZONE, type Injection } from '../../lib/api/inject';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type NavIcon = OverridableComponent<SvgIconTypeMap<{}, 'svg'>>;

export interface NavItem {
    href: string;
    labelKey: string;
    icon: NavIcon;
    match?: (path: string, query: ParsedUrlQuery) => boolean;
}

export const NAV_ITEMS: NavItem[] = [
    { href: '/server', labelKey: 'nav.server', icon: ComputerIcon },
    { href: '/media', labelKey: 'nav.media', icon: ImageIcon },
    { href: '/play', labelKey: 'nav.play', icon: PlayArrowIcon },
    { href: '/routes', labelKey: 'nav.routes', icon: HubOutlinedIcon },
    { href: '/plugins', labelKey: 'nav.plugins', icon: ExtensionIcon },
    { href: '/config', labelKey: 'nav.config', icon: TuneIcon },
];

// Reads the dotted suffix of a zone (everything after the first `.`), the
// per-page-key convention shared with the bottom panel's tab labels.
function zoneSuffix(zone: string): string | null {
    const dot = zone.indexOf('.');
    return dot === -1 ? null : zone.slice(dot + 1);
}

// Resolves plugin-contributed NAVBAR_PAGE injections into navbar items. Each
// injection is its own button; label/icon come from a `meta` export on the
// page module (see UI_INJECTION_ZONE.NAVBAR_PAGE), falling back to the
// page-key / plugin name and a default icon.
export function usePluginNavItems(): NavItem[] {
    const socket = useSocket();
    const [items, setItems] = useState<NavItem[]>([]);

    useEffect(() => {
        if (!socket) return;
        let mounted = true;

        const resolve = async () => {
            const injections = await socket.injects
                .getInjectsByZone(UI_INJECTION_ZONE.NAVBAR_PAGE)
                .catch(() => [] as Injection[]);
            if (!mounted) return;

            const resolved = await Promise.all(
                injections.map(async inj => {
                    const pageKey = zoneSuffix(inj.zone);
                    const meta = await socket.injects
                        .meta(inj.id)
                        .catch(() => null);
                    const href = pageKey
                        ? `/ext/${inj.plugin}/${pageKey}`
                        : `/ext/${inj.plugin}`;

                    return {
                        href,
                        labelKey: meta?.label ?? pageKey ?? inj.plugin,
                        icon: (meta?.icon ?? ExtensionIcon) as NavIcon,
                        match: (_path: string, query: ParsedUrlQuery) => {
                            if (query.plugin !== inj.plugin) return false;
                            const slug = query.slug;
                            const activeKey = Array.isArray(slug)
                                ? (slug[0] ?? null)
                                : null;
                            return activeKey === pageKey;
                        },
                    } satisfies NavItem;
                }),
            );

            if (mounted) setItems(resolved);
        };

        resolve();
        socket.injects.on('change', resolve);
        return () => {
            mounted = false;
            socket.injects.off('change', resolve);
        };
    }, [socket]);

    return items;
}
