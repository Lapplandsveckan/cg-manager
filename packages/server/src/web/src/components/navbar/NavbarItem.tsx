import { Box, ButtonBase, Tooltip, Typography, alpha } from '@mui/material';
import Link from 'next/link';
import { useTranslation } from 'next-i18next';
import { ICON_BOX_WIDTH } from './constants';
import { type NavItem } from './navItems';

export const NavbarItem: React.FC<{
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
                gap: 0,
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
                    ml: collapsed ? 0 : -1.25,
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
