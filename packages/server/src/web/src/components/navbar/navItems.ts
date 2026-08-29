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
import { UI_INJECTION_ZONE } from '../../lib/api/inject';
import { useInjectionsByZone } from '../../lib/query/pluginInjections';

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
    const injections = useInjectionsByZone(UI_INJECTION_ZONE.NAVBAR_PAGE);
    const ids = injections.map(i => i.id).join(',');
    const [items, setItems] = useState<NavItem[]>([]);

    useEffect(() => {
        let mounted = true;

        Promise.all(
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
        ).then(resolved => {
            if (mounted) setItems(resolved);
        });

        return () => {
            mounted = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [socket, ids]);

    return items;
}
