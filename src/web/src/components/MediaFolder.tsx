import React, { useState } from 'react';
import {
    Card,
    Grid,
    IconButton,
    Stack,
    Tooltip,
    Typography,
    alpha,
} from '@mui/material';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DriveFileRenameOutlineRoundedIcon from '@mui/icons-material/DriveFileRenameOutlineRounded';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import { useTranslation } from 'next-i18next';
import { hasMediaMovePayload, parseMediaMovePayload } from '../lib/dragPayload';
import { useContextMenu } from './ContextMenuProvider';

export interface MediaFolderProps {
    name: string;

    columns?: number;
    onClick?: () => void;
    onDelete?: () => void;
    onRename?: () => void;
    /** Fired when a draggable MediaCard is dropped on the folder. The
     *  caller (page) is responsible for issuing the moveMedia call —
     *  this component just surfaces the drop. */
    onMediaDrop?: (mediaId: string) => void;
}

export const MediaFolder: React.FC<MediaFolderProps> = ({
    name,
    columns,
    onClick,
    onDelete,
    onRename,
    onMediaDrop,
}) => {
    const { t } = useTranslation('common');
    const span = 60 / (columns ?? 5);
    const [dropHover, setDropHover] = useState(false);
    const hasActions = Boolean(onDelete || onRename);

    const isMediaDrag = (e: React.DragEvent) =>
        hasMediaMovePayload(e.dataTransfer);

    const onDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        if (!onMediaDrop || !isMediaDrag(e)) return;
        e.preventDefault();
        setDropHover(true);
    };
    const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        if (!onMediaDrop || !isMediaDrag(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!dropHover) setDropHover(true);
    };
    const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        // relatedTarget is the element entered; if it's still a descendant
        // we're not really leaving — same gotcha as Dropzone.
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDropHover(false);
    };
    const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
        if (!onMediaDrop || !isMediaDrag(e)) return;
        e.preventDefault();
        setDropHover(false);
        const payload = parseMediaMovePayload(e.dataTransfer);
        if (payload) onMediaDrop(payload.id);
    };

    const { openMenu } = useContextMenu();

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
                onContextMenu={e =>
                    openMenu(e, [
                        onClick && {
                            label: t('actions.open'),
                            icon: <FolderOpenOutlinedIcon fontSize="small" />,
                            onClick,
                        },
                        onRename && {
                            label: t('actions.rename'),
                            icon: (
                                <DriveFileRenameOutlineRoundedIcon fontSize="small" />
                            ),
                            onClick: onRename,
                        },
                        onDelete && {
                            label: t('actions.delete'),
                            icon: <DeleteOutlineRoundedIcon fontSize="small" />,
                            danger: true,
                            divider: true,
                            onClick: onDelete,
                        },
                    ])
                }
                onDragEnter={onDragEnter}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                sx={theme => ({
                    position: 'relative',
                    aspectRatio: '16/9',
                    cursor: onClick ? 'pointer' : 'default',
                    transition: theme.transitions.create(
                        ['border-color', 'background-color'],
                        {
                            duration: 120,
                        },
                    ),
                    '&:hover': onClick
                        ? {
                              borderColor: alpha(
                                  theme.palette.primary.main,
                                  0.45,
                              ),
                              bgcolor: theme.palette.surface.elevated,
                          }
                        : undefined,
                    '&:hover .media-folder-actions': hasActions
                        ? { opacity: 1 }
                        : {},
                    ...(dropHover && {
                        borderColor: theme.palette.primary.main,
                        bgcolor: alpha(theme.palette.primary.main, 0.12),
                    }),
                })}
            >
                {hasActions && (
                    <Stack
                        className="media-folder-actions"
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
                            <Tooltip title={t('media.folder.deleteTooltip')}>
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
                    alignItems="center"
                    justifyContent="center"
                    gap={1}
                >
                    <FolderOutlinedIcon
                        sx={{ color: 'text.secondary', fontSize: 28 }}
                    />
                    <Typography
                        variant="body1"
                        sx={{
                            color: 'text.primary',
                            wordBreak: 'break-word',
                            textAlign: 'center',
                            px: 1,
                        }}
                    >
                        {name}
                    </Typography>
                </Stack>
            </Card>
        </Grid>
    );
};
