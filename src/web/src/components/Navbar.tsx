import { type ParsedUrlQuery } from 'querystring';
import {
    Stack,
    type SvgIconTypeMap,
    Typography,
    ButtonBase,
    Box,
    Divider,
    IconButton,
    Tooltip,
    alpha,
    Menu,
    MenuItem,
} from '@mui/material';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { type OverridableComponent } from '@mui/material/OverridableComponent';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslation } from 'next-i18next';

import ComputerIcon from '@mui/icons-material/Computer';
import ImageIcon from '@mui/icons-material/Image';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ExtensionIcon from '@mui/icons-material/Extension';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import TuneIcon from '@mui/icons-material/Tune';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import LanguageIcon from '@mui/icons-material/Language';
import { noTryAsync } from 'no-try';
import { checkAuth } from '../lib/auth';
import { type CasparStatus } from '../lib/api/caspar';
import { useConnection } from './ConnectionProvider';
import { useSocket } from '../lib/hooks/useSocket';
import { useVersion } from '../lib/hooks/useVersion';
import { useStoredBoolean } from '../lib/hooks/useStoredBoolean';
import { UI_INJECTION_ZONE, type Injection } from '../lib/api/inject';
import {
    SUPPORTED_LANGUAGES,
    type SupportedLanguage,
    setStoredLanguage,
} from '../lib/detectLanguage';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type NavIcon = OverridableComponent<SvgIconTypeMap<{}, 'svg'>>;

interface NavItem {
    href: string;
    labelKey: string;
    icon: NavIcon;
    match?: (path: string, query: ParsedUrlQuery) => boolean;
}

const NAV_ITEMS: NavItem[] = [
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
function usePluginNavItems(): NavItem[] {
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

const EXPANDED_WIDTH = 200;
const COLLAPSED_WIDTH = 60;
const STORAGE_KEY = 'navbar-collapsed';
// Icons sit inside a fixed-width box matching the collapsed sidebar (minus
// its 3px indicator border) so they stay centered in the same spot whether
// the sidebar is collapsed or expanded — only the trailing label appears
// or disappears next to it.
const ICON_BOX_WIDTH = COLLAPSED_WIDTH - 3;

const NavbarItem: React.FC<{
    item: NavItem;
    active: boolean;
    collapsed: boolean;
}> = ({ item, active, collapsed }) => {
    const Icon = item.icon;
    const { t } = useTranslation('common');
    const label = t(item.labelKey);

    const inner = (
        <ButtonBase
            component={Link}
            href={item.href}
            sx={theme => ({
                display: 'flex',
                alignItems: 'center',
                gap: collapsed ? 0 : 1.5,
                width: '100%',
                pr: 2,
                py: 1.25,
                justifyContent: 'flex-start',
                color: active
                    ? theme.palette.text.primary
                    : theme.palette.text.secondary,
                backgroundColor: active
                    ? alpha(theme.palette.primary.main, 0.1)
                    : 'transparent',
                borderLeft: `3px solid ${active ? theme.palette.primary.main : 'transparent'}`,
                transition: theme.transitions.create(
                    ['background-color', 'color'],
                    {
                        duration: 120,
                    },
                ),
                '&:hover': {
                    backgroundColor: alpha(
                        theme.palette.primary.main,
                        active ? 0.14 : 0.05,
                    ),
                    color: theme.palette.text.primary,
                },
            })}
        >
            <Box
                sx={{
                    width: ICON_BOX_WIDTH,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Icon fontSize="small" />
            </Box>
            <Typography
                variant="body1"
                fontWeight={active ? 600 : 400}
                noWrap
                sx={{
                    width: collapsed ? 0 : 'auto',
                    opacity: collapsed ? 0 : 1,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                }}
            >
                {label}
            </Typography>
        </ButtonBase>
    );

    return collapsed ? (
        <Tooltip title={label} placement="right">
            {inner}
        </Tooltip>
    ) : (
        inner
    );
};

type StatusKey = 'unreachable' | 'running' | 'stopped' | 'unknown';

interface StatusInfo {
    color: string;
    key: StatusKey;
    glow: boolean;
}

function useCasparStatus(): StatusInfo {
    const socket = useSocket();
    const { state: connectionState } = useConnection();
    const [running, setRunning] = useState<boolean | null>(null);

    useEffect(() => {
        if (!socket) return;
        const listener = (status: CasparStatus) => setRunning(status.running);
        socket.caspar.on('status', listener);
        socket.caspar
            .getStatus()
            .then(listener)
            .catch(() => setRunning(null));
        return () => {
            socket.caspar.off('status', listener);
        };
    }, [socket]);

    // The websocket retains its last broadcast; once we know the manager is
    // unreachable, the cached running flag is stale and would otherwise keep
    // showing a green/red dot from before the outage. Surface as "Unreachable"
    // until heartbeats recover.
    if (connectionState === 'disconnected')
        return {
            color: 'rgba(232, 234, 237, 0.3)',
            key: 'unreachable',
            glow: false,
        };

    if (running === true)
        return { color: '#5fc97a', key: 'running', glow: true };
    if (running === false)
        return { color: '#cf5b4a', key: 'stopped', glow: false };
    return { color: 'rgba(232, 234, 237, 0.3)', key: 'unknown', glow: false };
}

const LanguageSelector: React.FC = () => {
    const { t, i18n } = useTranslation('common');
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);
    const [current, setCurrent] = useState<SupportedLanguage>(
        (SUPPORTED_LANGUAGES as readonly string[]).includes(i18n.language)
            ? (i18n.language as SupportedLanguage)
            : 'en',
    );

    const open = (e: React.MouseEvent<HTMLElement>) =>
        setAnchor(e.currentTarget);
    const close = () => setAnchor(null);

    const select = (lng: SupportedLanguage) => {
        i18n.changeLanguage(lng);
        setStoredLanguage(lng);
        setCurrent(lng);
        close();
    };

    return (
        <Box>
            <Tooltip title={t('language.label')} placement="right">
                <IconButton
                    size="small"
                    onClick={open}
                    sx={{ color: 'text.secondary' }}
                >
                    <LanguageIcon fontSize="small" />
                </IconButton>
            </Tooltip>
            <Menu
                anchorEl={anchor}
                open={Boolean(anchor)}
                onClose={close}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                {SUPPORTED_LANGUAGES.map(lng => (
                    <MenuItem
                        key={lng}
                        selected={lng === current}
                        onClick={() => select(lng)}
                    >
                        {t(`language.${lng}`)}
                    </MenuItem>
                ))}
            </Menu>
        </Box>
    );
};

async function logout() {
    await noTryAsync(() =>
        fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'same-origin',
        }),
    );
    // Hard reload so any in-memory state (socket, caches) is dropped — the
    // AuthGate on the next paint will redirect to /login.
    window.location.href = '/login';
}

export const Navbar = () => {
    const { t } = useTranslation('common');
    const version = useVersion();
    const router = useRouter();
    const status = useCasparStatus();
    const statusLabel = t(`casparStatus.${status.key}`);
    const [collapsed, setCollapsed] = useStoredBoolean(STORAGE_KEY, false);
    const toggleCollapsed = () => setCollapsed(v => !v);
    const [authEnabled, setAuthEnabled] = useState(false);
    const pluginNavItems = usePluginNavItems();

    useEffect(() => {
        let cancelled = false;
        checkAuth().then(status => {
            if (!cancelled && status?.enabled) setAuthEnabled(true);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const isActive = (item: NavItem) =>
        item.match
            ? item.match(router.pathname, router.query)
            : router.pathname.startsWith(item.href);

    return (
        <Stack
            direction="column"
            justifyContent="space-between"
            sx={theme => ({
                width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
                flexShrink: 0,
                bgcolor: theme.palette.surface.paper,
                borderRight: `1px solid ${theme.palette.divider}`,
                pt: 2,
                transition: theme.transitions.create('width', {
                    duration: 160,
                }),
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
                    <Stack
                        spacing={0.25}
                        sx={theme => ({
                            minWidth: 0,
                            overflow: 'hidden',
                            width: collapsed ? 0 : 'auto',
                            opacity: collapsed ? 0 : 1,
                            transition: theme.transitions.create(
                                ['width', 'opacity'],
                                { duration: 160 },
                            ),
                        })}
                    >
                        <Typography
                            variant="h4"
                            fontWeight={700}
                            letterSpacing="-0.01em"
                            noWrap
                            sx={{ whiteSpace: 'nowrap' }}
                        >
                            {t('brand.name')}
                        </Typography>
                        <Typography
                            variant="caption"
                            noWrap
                            sx={{ whiteSpace: 'nowrap' }}
                        >
                            {t('brand.tagline')}
                        </Typography>
                    </Stack>
                    <Tooltip
                        title={t(
                            collapsed ? 'sidebar.expand' : 'sidebar.collapse',
                        )}
                        placement="right"
                    >
                        <IconButton
                            size="small"
                            onClick={toggleCollapsed}
                            sx={{ color: 'text.secondary' }}
                        >
                            {collapsed ? (
                                <ChevronRightRoundedIcon fontSize="small" />
                            ) : (
                                <ChevronLeftRoundedIcon fontSize="small" />
                            )}
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

                {pluginNavItems.length > 0 && (
                    <>
                        <Divider sx={{ my: 1, mx: collapsed ? 1 : 2 }} />
                        <Stack>
                            {pluginNavItems.map(item => (
                                <NavbarItem
                                    key={item.href}
                                    item={item}
                                    active={isActive(item)}
                                    collapsed={collapsed}
                                />
                            ))}
                        </Stack>
                    </>
                )}
            </Stack>

            <Stack
                direction="row"
                alignItems="center"
                justifyContent={collapsed ? 'center' : 'flex-start'}
                gap={1}
                sx={theme => ({
                    px: collapsed ? 0 : 2,
                    // Content area is 24px; the 1px borderTop sits *above*
                    // it (content-box keeps the border out of the height).
                    // Lines up with the BottomPanel's top border across
                    // platforms — Mac and Windows render the same.
                    boxSizing: 'content-box',
                    height: 40,
                    flexShrink: 0,
                    borderTop: `1px solid ${theme.palette.divider}`,
                })}
            >
                <Tooltip
                    title={t('casparStatus.tooltip', {
                        status: statusLabel.toLowerCase(),
                        version,
                    })}
                    placement="right"
                >
                    <Stack
                        direction="row"
                        alignItems="center"
                        gap={1}
                        sx={collapsed ? {} : { flex: 1, minWidth: 0 }}
                    >
                        <Box
                            sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: status.color,
                                boxShadow: status.glow
                                    ? `0 0 6px ${status.color}`
                                    : 'none',
                            }}
                        />
                        {!collapsed && (
                            <Typography
                                variant="caption"
                                sx={{ color: 'text.secondary', lineHeight: 1 }}
                            >
                                {statusLabel}
                                <Box
                                    component="span"
                                    sx={{ color: 'text.disabled', ml: 0.75 }}
                                >
                                    · v{version}
                                </Box>
                            </Typography>
                        )}
                    </Stack>
                </Tooltip>

                {!collapsed && <LanguageSelector />}

                {!collapsed && authEnabled && (
                    <Tooltip title={t('auth.signOut')} placement="right">
                        <IconButton
                            size="small"
                            onClick={logout}
                            sx={{ color: 'text.secondary' }}
                        >
                            <LogoutRoundedIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                )}
            </Stack>
        </Stack>
    );
};
