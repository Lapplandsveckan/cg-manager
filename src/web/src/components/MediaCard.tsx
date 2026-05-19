import React, {useMemo} from 'react';
import {Card, Grid, IconButton, Stack, Tooltip, Typography} from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DriveFileRenameOutlineRoundedIcon from '@mui/icons-material/DriveFileRenameOutlineRounded';

function getDurationString(duration: number) {
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = Math.floor(duration % 60);
    const ms = Math.floor((duration % 1) * 1000);

    let H = hours.toString();
    let M = minutes.toString();
    let S = seconds.toString();
    let MS = ms.toString();

    if (hours < 10) H = `0${H}`;
    if (minutes < 10) M = `0${M}`;
    if (seconds < 10) S = `0${S}`;
    if (ms < 10) MS = `00${MS}`;

    let durationString = `${M}:${S}.${MS}`;
    if (hours > 0) durationString = `${H}:${durationString}`;
    return durationString;
}

export interface MediaCardProps {
    name: string;
    duration: number;

    backgroundUrl: string;

    columns?: number;
    onClick?: () => void;
    onDelete?: () => void;
    onRename?: () => void;
}

export const MediaCard: React.FC<MediaCardProps> = ({
    name,
    duration,
    backgroundUrl,
    columns,
    onClick,
    onDelete,
    onRename,
}) => {
    const durationString = useMemo(() => getDurationString(duration), [duration]);
    const span = 60 / (columns ?? 5);

    const hasActions = Boolean(onDelete || onRename);

    return (
        <Grid
            item xs={span} sm={span / 2} md={span / 3} lg={span / 4} xl={span / 5}
        >
            <Card
                onClick={() => onClick?.()}
                sx={{
                    position: 'relative',
                    aspectRatio: '16/9',
                    backgroundImage: `url(${backgroundUrl})`,
                    backgroundSize: 'cover',
                    cursor: onClick ? 'pointer' : 'default',
                    '&:hover .media-card-actions': hasActions ? { opacity: 1 } : {},
                }}
            >
                {hasActions && (
                    <Stack
                        className="media-card-actions"
                        direction="row"
                        gap={0.5}
                        sx={{
                            position: 'absolute',
                            top: 6,
                            right: 6,
                            opacity: 0,
                            transition: 'opacity 120ms',
                            bgcolor: 'rgba(20, 18, 17, 0.7)',
                            borderRadius: 1,
                            backdropFilter: 'blur(4px)',
                            padding: '2px',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {onRename && (
                            <Tooltip title="Rename">
                                <IconButton size="small" onClick={onRename} sx={{ color: 'rgba(232, 234, 237, 0.85)' }}>
                                    <DriveFileRenameOutlineRoundedIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        )}
                        {onDelete && (
                            <Tooltip title="Delete">
                                <IconButton size="small" onClick={onDelete} sx={{ color: '#e88c8c' }}>
                                    <DeleteOutlineRoundedIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Stack>
                )}

                <Stack height="100%" direction="column" alignItems="stretch" justifyContent="end">
                    <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"

                        sx={{
                            backgroundColor: 'rgba(0, 0, 0, 0.55)',
                            padding: '5px',
                        }}
                    >
                        <Typography fontSize="11px" color="#e8eaed" sx={{ wordBreak: 'break-all' }}>{name}</Typography>
                        <Typography fontSize="10px" color="rgba(232, 234, 237, 0.65)">{durationString}</Typography>
                    </Stack>
                </Stack>
            </Card>
        </Grid>
    );
};