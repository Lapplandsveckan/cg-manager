import {
    Card,
    CardActionArea,
    IconButton,
    Stack,
    Switch,
    Tooltip,
    Typography,
} from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { useTranslation } from 'next-i18next';
import type { VideoRoute } from '../../lib/api/videoRoutes';
import {
    summariseSource,
    summariseDestination,
} from '../../lib/routes/routeFormatters';
import { StatusPill } from './StatusPill';
import { useContextMenu } from '../ContextMenuProvider';

interface RouteCardProps {
    route: VideoRoute;
    onEdit: () => void;
    onToggle: (next: boolean) => void;
    onDelete: () => void;
}

export const RouteCard: React.FC<RouteCardProps> = ({
    route,
    onEdit,
    onToggle,
    onDelete,
}) => {
    const { t } = useTranslation('common');
    const { openMenu } = useContextMenu();
    // CardActionArea wraps the whole card so clicking anywhere opens the
    // editor — except for the inline controls (Switch / Delete) which stop
    // propagation so they don't double-fire as "edit this".
    const stop = (e: React.MouseEvent | React.SyntheticEvent) =>
        e.stopPropagation();

    return (
        <Card
            sx={{ p: 0 }}
            onContextMenu={e =>
                openMenu(e, [
                    {
                        label: t('actions.edit'),
                        icon: <EditOutlinedIcon fontSize="small" />,
                        onClick: onEdit,
                    },
                    {
                        label: route.enabled
                            ? t('actions.disable')
                            : t('actions.enable'),
                        onClick: () => onToggle(!route.enabled),
                    },
                    {
                        label: t('actions.delete'),
                        icon: <DeleteOutlineRoundedIcon fontSize="small" />,
                        danger: true,
                        divider: true,
                        onClick: onDelete,
                    },
                ])
            }
        >
            <CardActionArea
                onClick={onEdit}
                sx={{ p: 2.5, alignItems: 'stretch' }}
            >
                <Stack
                    direction="row"
                    alignItems="flex-start"
                    justifyContent="space-between"
                    gap={2}
                >
                    <Stack spacing={0.75} sx={{ minWidth: 0, flexGrow: 1 }}>
                        <Stack direction="row" alignItems="center" gap={1.25}>
                            <Typography
                                variant="h4"
                                sx={{ wordBreak: 'break-word' }}
                            >
                                {route.name || t('videoRoutes.unnamed')}
                            </Typography>
                            <StatusPill enabled={route.enabled} />
                        </Stack>
                        <Stack
                            direction="row"
                            alignItems="center"
                            gap={1}
                            flexWrap="wrap"
                        >
                            <Typography
                                variant="body2"
                                sx={theme => ({
                                    fontFamily:
                                        '"SF Mono", "Menlo", "Consolas", monospace',
                                    color: theme.palette.text.secondary,
                                    wordBreak: 'break-word',
                                })}
                            >
                                {summariseSource(t, route.source)}
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{ color: 'text.disabled' }}
                            >
                                →
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={theme => ({
                                    fontFamily:
                                        '"SF Mono", "Menlo", "Consolas", monospace',
                                    color: theme.palette.text.secondary,
                                    wordBreak: 'break-word',
                                })}
                            >
                                {summariseDestination(route.destination)}
                            </Typography>
                        </Stack>
                    </Stack>

                    <Stack
                        direction="row"
                        alignItems="center"
                        gap={0.5}
                        sx={{ flexShrink: 0 }}
                        onClick={stop}
                        onMouseDown={stop}
                    >
                        <Switch
                            color="primary"
                            checked={route.enabled}
                            onChange={(_, checked) => onToggle(checked)}
                            onClick={stop}
                            inputProps={{
                                'aria-label': t('videoRoutes.toggleAria', {
                                    name: route.name,
                                }),
                            }}
                        />
                        <Tooltip title={t('actions.delete')}>
                            <IconButton
                                size="small"
                                onClick={e => {
                                    stop(e);
                                    onDelete();
                                }}
                                sx={{ color: '#e88c8c' }}
                            >
                                <DeleteOutlineRoundedIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                </Stack>
            </CardActionArea>
        </Card>
    );
};
