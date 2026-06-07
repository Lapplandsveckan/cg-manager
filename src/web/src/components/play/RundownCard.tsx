import {
    Card,
    CardActionArea,
    Chip,
    IconButton,
    Stack,
    Tooltip,
    Typography,
    alpha,
} from '@mui/material';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import React, { useMemo } from 'react';
import { useTranslation } from 'next-i18next';
import type { Rundown, RundownItem } from '../../hooks/useRundowns';

interface RundownCardProps {
    rundown: Rundown;
    onOpen: () => void;
    onEdit: () => void;
    onDelete: () => void;
}

function formatItemType(type: string): string {
    if (!type) return 'unknown';
    return type
        .split(/[-_]/)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function summariseTypes(
    items: RundownItem[],
): { label: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const item of items)
        counts.set(item.type, (counts.get(item.type) ?? 0) + 1);
    return Array.from(counts.entries())
        .sort(([a, ca], [b, cb]) => cb - ca || a.localeCompare(b))
        .map(([type, count]) => ({ label: formatItemType(type), count }));
}

export const RundownCard: React.FC<RundownCardProps> = ({
    rundown,
    onOpen,
    onEdit,
    onDelete,
}) => {
    const { t } = useTranslation('common');
    const stop = (e: React.MouseEvent | React.SyntheticEvent) =>
        e.stopPropagation();
    const itemCount = rundown.items?.length ?? 0;
    const typeBreakdown = useMemo(
        () => summariseTypes(rundown.items ?? []),
        [rundown.items],
    );

    return (
        <Card sx={{ p: 0 }}>
            <CardActionArea
                onClick={onOpen}
                sx={{ p: 2.5, alignItems: 'stretch' }}
            >
                <Stack
                    direction="row"
                    alignItems="flex-start"
                    justifyContent="space-between"
                    gap={2}
                >
                    <Stack spacing={1.25} sx={{ minWidth: 0, flexGrow: 1 }}>
                        <Stack
                            direction="row"
                            alignItems="baseline"
                            gap={1.25}
                            flexWrap="wrap"
                        >
                            <Typography
                                variant="h4"
                                sx={{ wordBreak: 'break-word' }}
                            >
                                {rundown.name || t('playPage.unnamedRundown')}
                            </Typography>
                            <Typography
                                variant="caption"
                                sx={{ color: 'text.disabled' }}
                            >
                                {itemCount === 0
                                    ? t('playPage.itemCount.empty')
                                    : t('playPage.itemCount.count', {
                                          count: itemCount,
                                      })}
                            </Typography>
                        </Stack>

                        {typeBreakdown.length === 0 ? (
                            <Typography
                                variant="body2"
                                sx={{ color: 'text.disabled' }}
                            >
                                {t('playPage.noItemsHint')}
                            </Typography>
                        ) : (
                            <Stack direction="row" gap={0.75} flexWrap="wrap">
                                {typeBreakdown.map(({ label, count }) => (
                                    <Chip
                                        key={label}
                                        size="small"
                                        label={
                                            count > 1
                                                ? `${label} × ${count}`
                                                : label
                                        }
                                        sx={theme => ({
                                            bgcolor: alpha(
                                                theme.palette.primary.main,
                                                0.08,
                                            ),
                                            borderColor: alpha(
                                                theme.palette.primary.main,
                                                0.25,
                                            ),
                                            color: 'text.secondary',
                                        })}
                                        variant="outlined"
                                    />
                                ))}
                            </Stack>
                        )}
                    </Stack>

                    <Stack
                        direction="row"
                        alignItems="center"
                        gap={0.5}
                        sx={{ flexShrink: 0 }}
                        onClick={stop}
                        onMouseDown={stop}
                    >
                        <Tooltip title={t('actions.rename')}>
                            <IconButton
                                size="small"
                                onClick={e => {
                                    stop(e);
                                    onEdit();
                                }}
                                sx={{ color: 'text.secondary' }}
                            >
                                <EditRoundedIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
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
