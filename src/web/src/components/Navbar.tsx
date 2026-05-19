import {Stack, SvgIconTypeMap, Typography, ButtonBase, Box, Tooltip, alpha} from '@mui/material';
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

const NavbarItem: React.FC<{ item: NavItem; active: boolean }> = ({ item, active }) => {
    const Icon = item.icon;
    return (
        <ButtonBase
            component={Link}
            href={item.href}
            sx={(theme) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                width: '100%',
                px: 2,
                py: 1.25,
                justifyContent: 'flex-start',
                color: active ? theme.palette.text.primary : theme.palette.text.secondary,
                backgroundColor: active ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                borderLeft: `3px solid ${active ? theme.palette.primary.main : 'transparent'}`,
                paddingLeft: active ? '13px' : '16px', // compensate so label position stays put
                transition: theme.transitions.create(['background-color', 'color'], { duration: 120 }),
                '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, active ? 0.14 : 0.05),
                    color: theme.palette.text.primary,
                },
            })}
        >
            <Icon fontSize="small" />
            <Typography variant="body1" fontWeight={active ? 600 : 400}>{item.label}</Typography>
        </ButtonBase>
    );
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

export const Navbar = () => {
    const version = useVersion();
    const router = useRouter();
    const status = useCasparStatus();

    const isActive = (item: NavItem) =>
        item.match ? item.match(router.pathname) : router.pathname.startsWith(item.href);

    return (
        <Stack
            direction="column"
            justifyContent="space-between"
            sx={(theme) => ({
                width: 200,
                flexShrink: 0,
                bgcolor: theme.palette.surface.paper,
                borderRight: `1px solid ${theme.palette.divider}`,
                py: 2,
            })}
        >
            <Stack>
                <Stack px={2} pb={2.5} spacing={0.25}>
                    <Typography variant="h4" fontWeight={700} letterSpacing="-0.01em">
                        CG Manager
                    </Typography>
                    <Typography variant="caption">
                        CasparCG control
                    </Typography>
                </Stack>

                <Stack>
                    {NAV_ITEMS.map(item => (
                        <NavbarItem key={item.href} item={item} active={isActive(item)} />
                    ))}
                </Stack>
            </Stack>

            <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={(theme) => ({
                    px: 2,
                    pt: 1.5,
                    borderTop: `1px solid ${theme.palette.divider}`,
                })}
            >
                <Tooltip title={`CasparCG ${status.label.toLowerCase()}`} placement="top">
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
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {status.label}
                        </Typography>
                    </Stack>
                </Tooltip>
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                    v{version}
                </Typography>
            </Stack>
        </Stack>
    );
};
