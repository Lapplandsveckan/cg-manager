import {
    Stack,
    Typography,
    Box,
    Divider,
    IconButton,
    Tooltip,
} from '@mui/material';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'next-i18next';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import { checkAuth } from '../lib/auth';
import { useVersion } from '../lib/hooks/useVersion';
import { useStoredBoolean } from '../lib/hooks/useStoredBoolean';
import {
    EXPANDED_WIDTH,
    COLLAPSED_WIDTH,
    STORAGE_KEY,
} from './navbar/constants';
import { NAV_ITEMS, usePluginNavItems, type NavItem } from './navbar/navItems';
import { NavbarItem } from './navbar/NavbarItem';
import { useCasparStatus } from './navbar/useCasparStatus';
import { LanguageSelector } from './navbar/LanguageSelector';
import { logout } from './navbar/logout';

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
