import { useState } from 'react';
import {
    Box,
    Button,
    Card,
    Chip,
    Divider,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Stack,
    Switch,
    Typography,
    alpha,
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { useTranslation } from 'next-i18next';
import { type Plugin } from '../lib/api/plugin';
import { useContextMenu } from './ContextMenuProvider';

export interface PluginCardProps {
    plugin: Plugin;
    hasUi: boolean;
    channelCount: number;
    onToggle: (next: boolean) => void;
    onOpen: () => void;
    onUninstall: () => void;
    onSelectVersion: (version: string) => void;
    onDeleteVersion: (version: string) => void;
}

const StatusPill: React.FC<{ enabled: boolean }> = ({ enabled }) => {
    const { t } = useTranslation('common');
    const color = enabled ? '#5fc97a' : 'rgba(232, 234, 237, 0.4)';
    return (
        <Stack
            direction="row"
            alignItems="center"
            gap={0.75}
            sx={theme => ({
                px: 1,
                py: 0.25,
                borderRadius: 1,
                bgcolor: enabled
                    ? alpha('#5fc97a', 0.1)
                    : alpha(theme.palette.text.primary, 0.04),
                border: `1px solid ${enabled ? alpha('#5fc97a', 0.3) : theme.palette.divider}`,
            })}
        >
            <Box
                sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: color,
                }}
            />
            <Typography
                variant="caption"
                sx={{ color: enabled ? '#5fc97a' : 'text.secondary' }}
            >
                {enabled
                    ? t('pluginsPage.status.active')
                    : t('pluginsPage.status.disabled')}
            </Typography>
        </Stack>
    );
};

const VersionsMenu: React.FC<{
    plugin: Plugin;
    disabled?: boolean;
    onSelectVersion: (version: string) => void;
    onDeleteVersion: (version: string) => void;
}> = ({ plugin, disabled, onSelectVersion, onDeleteVersion }) => {
    const { t } = useTranslation('common');
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

    return (
        <>
            <Button
                size="small"
                color="inherit"
                disabled={disabled}
                sx={{ minWidth: 0, px: 0.75, py: 0.5 }}
                title={t('pluginsPage.versions.button')}
                onClick={e => {
                    e.stopPropagation();
                    setAnchorEl(e.currentTarget);
                }}
            >
                <HistoryRoundedIcon fontSize="small" />
            </Button>
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={() => setAnchorEl(null)}
                onClick={e => e.stopPropagation()}
            >
                <ListItemText
                    sx={{ px: 2, py: 0.5, color: 'text.secondary' }}
                    primaryTypographyProps={{ variant: 'caption' }}
                >
                    {t('pluginsPage.versions.menuTitle')}
                </ListItemText>
                <Divider />
                {(plugin.versions ?? []).map(version => {
                    const isActive = version === plugin.activeVersion;
                    return (
                        <MenuItem
                            key={version}
                            disabled={isActive}
                            onClick={() => {
                                setAnchorEl(null);
                                onSelectVersion(version);
                            }}
                        >
                            <ListItemIcon>
                                {isActive && (
                                    <CheckRoundedIcon fontSize="small" />
                                )}
                            </ListItemIcon>
                            <ListItemText
                                primary={`v${version}`}
                                secondary={
                                    isActive
                                        ? t('pluginsPage.versions.current')
                                        : t('pluginsPage.versions.switch')
                                }
                            />
                            <Button
                                size="small"
                                color="error"
                                sx={{ minWidth: 0, px: 0.75, ml: 1 }}
                                title={t('pluginsPage.versions.delete')}
                                onClick={e => {
                                    e.stopPropagation();
                                    setAnchorEl(null);
                                    onDeleteVersion(version);
                                }}
                            >
                                <DeleteOutlineRoundedIcon fontSize="small" />
                            </Button>
                        </MenuItem>
                    );
                })}
            </Menu>
        </>
    );
};

export const PluginCard: React.FC<PluginCardProps> = ({
    plugin,
    hasUi,
    channelCount,
    onToggle,
    onOpen,
    onUninstall,
    onSelectVersion,
    onDeleteVersion,
}) => {
    const { t } = useTranslation('common');
    const { openSurfaceMenu } = useContextMenu();
    const insufficient =
        plugin.minChannels > 0 && channelCount < plugin.minChannels;
    const hasVersions = (plugin.versions?.length ?? 0) > 0;
    const showVersions = plugin.builtin || hasVersions;
    return (
        <Card
            onClick={hasUi ? onOpen : undefined}
            onContextMenu={e =>
                openSurfaceMenu(
                    e,
                    'plugin',
                    {
                        name: plugin.name,
                        enabled: plugin.enabled,
                        builtin: plugin.builtin ?? false,
                        hasUi,
                        minChannels: plugin.minChannels,
                    },
                    [
                        hasUi && {
                            label: t('actions.open'),
                            icon: <OpenInNewRoundedIcon fontSize="small" />,
                            onClick: onOpen,
                        },
                        {
                            label: plugin.enabled
                                ? t('actions.disable')
                                : t('actions.enable'),
                            onClick: () => onToggle(!plugin.enabled),
                        },
                        !plugin.builtin && {
                            label: t('pluginsPage.uninstall.button'),
                            icon: <DeleteOutlineRoundedIcon fontSize="small" />,
                            danger: true,
                            divider: true,
                            onClick: onUninstall,
                        },
                    ],
                )
            }
            sx={theme => ({
                p: 2.5,
                ...(hasUi && { cursor: 'pointer' }),
                transition: theme.transitions.create(
                    ['border-color', 'background-color'],
                    { duration: 120 },
                ),
                ...(hasUi && {
                    '&:hover': {
                        borderColor: alpha(theme.palette.primary.main, 0.45),
                        bgcolor: theme.palette.surface.elevated,
                    },
                }),
            })}
        >
            <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap={2}
            >
                <Stack spacing={0.5} sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Stack direction="row" alignItems="center" gap={1.25}>
                        <Typography
                            variant="h4"
                            sx={{ wordBreak: 'break-word' }}
                        >
                            {plugin.name}
                        </Typography>
                        <StatusPill enabled={plugin.enabled} />
                        {plugin.activeVersion && (
                            <Chip
                                size="small"
                                label={`v${plugin.activeVersion}`}
                                sx={{ fontFamily: 'monospace' }}
                            />
                        )}
                        {insufficient && (
                            <Chip
                                size="small"
                                icon={
                                    <WarningAmberRoundedIcon
                                        sx={{ fontSize: '0.9rem !important' }}
                                    />
                                }
                                label={t('pluginsPage.channels.insufficient', {
                                    need: plugin.minChannels,
                                    have: channelCount,
                                })}
                                sx={theme => ({
                                    bgcolor: alpha(
                                        theme.palette.warning.main,
                                        0.1,
                                    ),
                                    color: theme.palette.warning.main,
                                    border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
                                    '& .MuiChip-icon': { color: 'inherit' },
                                })}
                            />
                        )}
                    </Stack>
                    <Typography
                        variant="body2"
                        sx={{ color: 'text.secondary' }}
                    >
                        {hasUi
                            ? t('pluginsPage.card.openForConfig')
                            : t('pluginsPage.card.noUi')}
                    </Typography>
                </Stack>

                <Stack
                    direction="row"
                    alignItems="center"
                    gap={0.5}
                    sx={{ flexShrink: 0 }}
                    onClick={e => e.stopPropagation()}
                >
                    <Switch
                        color="primary"
                        checked={plugin.enabled}
                        onChange={(_, checked) => onToggle(checked)}
                        inputProps={{
                            'aria-label': t('pluginsPage.togglePlugin', {
                                name: plugin.name,
                            }),
                        }}
                    />
                    {showVersions && (
                        <VersionsMenu
                            plugin={plugin}
                            disabled={!!plugin.builtin}
                            onSelectVersion={onSelectVersion}
                            onDeleteVersion={onDeleteVersion}
                        />
                    )}
                    <Button
                        size="small"
                        color="error"
                        disabled={!!plugin.builtin}
                        sx={{ minWidth: 0, px: 0.75, py: 0.5 }}
                        title={t('pluginsPage.uninstall.button')}
                        onClick={e => {
                            e.stopPropagation();
                            onUninstall();
                        }}
                    >
                        <DeleteOutlineRoundedIcon fontSize="small" />
                    </Button>
                    <ChevronRightIcon
                        fontSize="small"
                        sx={{
                            color: 'text.disabled',
                            pointerEvents: 'none',
                            visibility: hasUi ? 'visible' : 'hidden',
                        }}
                    />
                </Stack>
            </Stack>
        </Card>
    );
};
