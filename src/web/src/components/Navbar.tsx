import {Stack, SvgIconTypeMap, Typography, ButtonBase, Box, IconButton, Tooltip, alpha} from '@mui/material';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import {useVersion} from '../lib/hooks/useVersion';
import {useSocket} from '../lib/hooks/useSocket';
import {CasparStatus} from '../lib/api/caspar';
import {OverridableComponent} from '@mui/material/OverridableComponent';
import {useRouter} from 'next/router';
import Link from 'next/link';
import {useEffect, useState} from 'react';

import ComputerIcon from '@mui/icons-material/Computer';
import ImageIcon from '@mui/icons-material/Image';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ExtensionIcon from '@mui/icons-material/Extension';

type NavIcon = OverridableComponent<SvgIconTypeMap<{}, 'svg'>>;

interface NavItem {
    href: string;
    label: string;
    icon: NavIcon;
    match?: (path: string) => boolean;
}

const NAV_ITEMS: NavItem[] = [
    { href: '/server',  label: 'Server',  icon: ComputerIcon },
    { href: '/media',   label: 'Media',   icon: ImageIcon },
    { href: '/play',    label: 'Play',    icon: PlayArrowIcon },
    { href: '/plugins', label: 'Plugins', icon: ExtensionIcon },
];

const EXPANDED_WIDTH = 200;
const COLLAPSED_WIDTH = 60;
const STORAGE_KEY = 'navbar-collapsed';

const NavbarItem: React.FC<{ item: NavItem; active: boolean; collapsed: boolean }> = ({ item, active, collapsed }) => {
    const Icon = item.icon;

    const inner = (
        <ButtonBase
            component={Link}
            href={item.href}
            sx={(theme) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                width: '100%',
                px: collapsed ? 0 : 2,
                py: 1.25,
                justifyContent: collapsed ? 'center' : 'flex-start',
                color: active ? theme.palette.text.primary : theme.palette.text.secondary,
                backgroundColor: active ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                borderLeft: `3px solid ${active ? theme.palette.primary.main : 'transparent'}`,
                paddingLeft: collapsed ? 0 : (active ? '13px' : '16px'),
                transition: theme.transitions.create(['background-color', 'color'], { duration: 120 }),
                '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, active ? 0.14 : 0.05),
                    color: theme.palette.text.primary,
                },
            })}
        >
            <Icon fontSize="small" />
            {!collapsed && (
                <Typography variant="body1" fontWeight={active ? 600 : 400}>
                    {item.label}
                </Typography>
            )}
        </ButtonBase>
    );

    return collapsed ? (
        <Tooltip title={item.label} placement="right">
            {inner}
        </Tooltip>
    ) : inner;
};

interface StatusInfo {
    color: string;
    label: string;
    glow: boolean;
}

function useCasparStatus(): StatusInfo {
    const socket = useSocket();
    const [running, setRunning] = useState<boolean | null>(null);

    useEffect(() => {
        if (!socket) return;
        const listener = (status: CasparStatus) => setRunning(status.running);
        socket.caspar.on('status', listener);
        socket.caspar.getStatus().then(listener).catch(() => setRunning(null));
        return () => { socket.caspar.off('status', listener); };
    }, [socket]);

    if (running === true) return { color: '#5fc97a', label: 'Running',   glow: true };
    if (running === false) return { color: '#cf5b4a', label: 'Stopped',   glow: false };
    return { color: 'rgba(232, 234, 237, 0.3)', label: 'Unknown', glow: false };
}

function useNavbarCollapsed(): [boolean, () => void] {
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            setCollapsed(window.localStorage.getItem(STORAGE_KEY) === '1');
        } catch {
            /* ignore */
        }
    }, []);

    const toggle = () => {
        setCollapsed(prev => {
            const next = !prev;
            try { window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0'); } catch { /* ignore */ }
            return next;
        });
    };

    return [collapsed, toggle];
}

export const Navbar = () => {
    const version = useVersion();
    const router = useRouter();
    const status = useCasparStatus();
    const [collapsed, toggleCollapsed] = useNavbarCollapsed();

    const isActive = (item: NavItem) =>
        item.match ? item.match(router.pathname) : router.pathname.startsWith(item.href);

    return (
        <Stack
            direction="column"
            justifyContent="space-between"
            sx={(theme) => ({
                width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
                flexShrink: 0,
                bgcolor: theme.palette.surface.paper,
                borderRight: `1px solid ${theme.palette.divider}`,
                py: 2,
                transition: theme.transitions.create('width', { duration: 160 }),
            })}
        >
            <Stack>
                <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent={collapsed ? 'center' : 'space-between'}
                    px={collapsed ? 0 : 2}
                    pb={2.5}
                    gap={1}
                >
                    {!collapsed && (
                        <Stack spacing={0.25} sx={{ minWidth: 0, overflow: 'hidden' }}>
                            <Typography
                                variant="h4"
                                fontWeight={700}
                                letterSpacing="-0.01em"
                                noWrap
                                sx={{ whiteSpace: 'nowrap' }}
                            >
                                CG Manager
                            </Typography>
                            <Typography variant="caption" noWrap sx={{ whiteSpace: 'nowrap' }}>
                                CasparCG control
                            </Typography>
                        </Stack>
                    )}
                    <Tooltip title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} placement="right">
                        <IconButton
                            size="small"
                            onClick={toggleCollapsed}
                            sx={{ color: 'text.secondary' }}
                        >
                            {collapsed
                                ? <ChevronRightRoundedIcon fontSize="small" />
                                : <ChevronLeftRoundedIcon fontSize="small" />}
                        </IconButton>
                    </Tooltip>
                </Stack>

                <Stack>
                    {NAV_ITEMS.map(item => (
                        <NavbarItem
                            key={item.href}
                            item={item}
                            active={isActive(item)}
                            collapsed={collapsed}
                        />
                    ))}
                </Stack>
            </Stack>

            <Stack
                direction={collapsed ? 'column' : 'row'}
                alignItems="center"
                justifyContent={collapsed ? 'center' : 'space-between'}
                gap={collapsed ? 1 : 0}
                sx={(theme) => ({
                    px: collapsed ? 0 : 2,
                    pt: 1.5,
                    borderTop: `1px solid ${theme.palette.divider}`,
                })}
            >
                <Tooltip
                    title={collapsed
                        ? `CasparCG ${status.label.toLowerCase()} · v${version}`
                        : `CasparCG ${status.label.toLowerCase()}`
                    }
                    placement="right"
                >
                    <Stack direction="row" alignItems="center" gap={1}>
                        <Box
                            sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: status.color,
                                boxShadow: status.glow ? `0 0 6px ${status.color}` : 'none',
                            }}
                        />
                        {!collapsed && (
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                {status.label}
                            </Typography>
                        )}
                    </Stack>
                </Tooltip>
                {!collapsed && (
                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                        v{version}
                    </Typography>
                )}
            </Stack>
        </Stack>
    );
};
