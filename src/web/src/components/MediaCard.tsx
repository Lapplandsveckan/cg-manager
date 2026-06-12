import React, { useMemo } from 'react';
import {
    Card,
    Grid,
    IconButton,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DriveFileRenameOutlineRoundedIcon from '@mui/icons-material/DriveFileRenameOutlineRounded';
import PageviewRoundedIcon from '@mui/icons-material/PageviewRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import { useTranslation } from 'next-i18next';
import { MEDIA_MOVE_DRAG_MIME } from '../lib/dragPayload';

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
    onPlay?: () => void;
    onInspect?: () => void;
    onDelete?: () => void;
    onRename?: () => void;
    /** Full media id (slash-separated). When set, the card is draggable
     *  and writes a {@link MEDIA_MOVE_DRAG_MIME} payload on dragstart, so
     *  folders and breadcrumbs on the Media page can receive the drop and
     *  move the file. */
    dragId?: string;
}

export const MediaCard: React.FC<MediaCardProps> = ({
    name,
    duration,
    backgroundUrl,
    columns,
    onClick,
    onPlay,
    onInspect,
    onDelete,
    onRename,
    dragId,
}) => {
    const { t } = useTranslation('common');
    const durationString = useMemo(
        () => getDurationString(duration),
        [duration],
    );
    const span = 60 / (columns ?? 5);

    const hasActions = Boolean(onPlay || onInspect || onDelete || onRename);

    return (
        <Grid
            item
            xs={span}
            sm={span / 2}
            md={span / 3}
            lg={span / 4}
            xl={span / 5}
        >
            <Card
                onClick={() => onClick?.()}
                draggable={Boolean(dragId)}
                onDragStart={
                    dragId
                        ? e => {
                              e.dataTransfer.setData(
                                  MEDIA_MOVE_DRAG_MIME,
                                  JSON.stringify({ id: dragId }),
                              );
                              e.dataTransfer.effectAllowed = 'move';
                          }
                        : undefined
                }
                sx={theme => ({
                    position: 'relative',
                    aspectRatio: '16/9',
                    backgroundImage: `url(${backgroundUrl})`,
                    // Show the whole thumbnail (letterbox/pillarbox the gaps)
                    // instead of cropping it to fill the 16:9 card.
                    backgroundSize: 'contain',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    backgroundColor: theme.palette.surface.base,
                    cursor: onClick ? 'pointer' : 'default',
                    '&:hover .media-card-actions': hasActions
                        ? { opacity: 1 }
                        : {},
                })}
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
                        onClick={e => e.stopPropagation()}
                    >
                        {onPlay && (
                            <Tooltip title={t('actions.play')}>
                                <IconButton
                                    size="small"
                                    onClick={onPlay}
                                    sx={{ color: 'rgba(232, 234, 237, 0.85)' }}
                                >
                                    <PlayArrowRoundedIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        )}
                        {onInspect && (
                            <Tooltip title={t('actions.inspect')}>
                                <IconButton
                                    size="small"
                                    onClick={onInspect}
                                    sx={{ color: 'rgba(232, 234, 237, 0.85)' }}
                                >
                                    <PageviewRoundedIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        )}
                        {onRename && (
                            <Tooltip title={t('actions.rename')}>
                                <IconButton
                                    size="small"
                                    onClick={onRename}
                                    sx={{ color: 'rgba(232, 234, 237, 0.85)' }}
                                >
                                    <DriveFileRenameOutlineRoundedIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        )}
                        {onDelete && (
                            <Tooltip title={t('actions.delete')}>
                                <IconButton
                                    size="small"
                                    onClick={onDelete}
                                    sx={{ color: '#e88c8c' }}
                                >
                                    <DeleteOutlineRoundedIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Stack>
                )}

                <Stack
                    height="100%"
                    direction="column"
                    alignItems="stretch"
                    justifyContent="end"
                >
                    <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{
                            backgroundColor: 'rgba(0, 0, 0, 0.55)',
                            padding: '5px',
                        }}
                    >
                        <Typography
                            fontSize="11px"
                            color="#e8eaed"
                            sx={{ wordBreak: 'break-all' }}
                        >
                            {name}
                        </Typography>
                        <Typography
                            fontSize="10px"
                            color="rgba(232, 234, 237, 0.65)"
                        >
                            {durationString}
                        </Typography>
                    </Stack>
                </Stack>
            </Card>
        </Grid>
    );
};
