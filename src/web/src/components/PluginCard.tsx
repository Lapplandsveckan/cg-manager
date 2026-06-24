import {
    Box,
    Button,
    Card,
    Chip,
    Stack,
    Switch,
    Typography,
    alpha,
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
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

export const PluginCard: React.FC<PluginCardProps> = ({
    plugin,
    hasUi,
    channelCount,
    onToggle,
    onOpen,
    onUninstall,
}) => {
    const { t } = useTranslation('common');
    const { openMenu } = useContextMenu();
    const insufficient =
        plugin.minChannels > 0 && channelCount < plugin.minChannels;
    return (
        <Card
            onClick={onOpen}
            onContextMenu={e =>
                openMenu(e, [
                    {
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
                ])
            }
            sx={theme => ({
                p: 2.5,
                cursor: 'pointer',
                transition: theme.transitions.create(
                    ['border-color', 'background-color'],
                    { duration: 120 },
                ),
                '&:hover': {
                    borderColor: alpha(theme.palette.primary.main, 0.45),
                    bgcolor: theme.palette.surface.elevated,
                },
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
                    {!plugin.builtin && (
                        <Button
                            size="small"
                            color="error"
                            sx={{ minWidth: 0, px: 0.75, py: 0.5 }}
                            title={t('pluginsPage.uninstall.button')}
                            onClick={e => {
                                e.stopPropagation();
                                onUninstall();
                            }}
                        >
                            <DeleteOutlineRoundedIcon fontSize="small" />
                        </Button>
                    )}
                    <ChevronRightIcon
                        fontSize="small"
                        sx={{ color: 'text.disabled', pointerEvents: 'none' }}
                    />
                </Stack>
            </Stack>
        </Card>
    );
};
