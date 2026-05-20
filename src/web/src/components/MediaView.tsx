import {Box, Button, Card, Grid, IconButton, Modal, Stack, Tooltip, Typography, alpha} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import {useSocket} from '../lib/hooks/useSocket';
import React, {useEffect, useMemo, useState} from 'react';
import {MediaDoc} from '../lib/api/caspar';
import {MediaCard} from '../components/MediaCard';


export interface MediaFolderProps {
    name: string;

    columns?: number;
    onClick?: () => void;
}

export const MediaFolder: React.FC<MediaFolderProps> = ({name, columns, onClick}) => {
    const span = 60 / (columns ?? 5);

    return (
        <Grid
            item xs={span} sm={span / 2} md={span / 3} lg={span / 4} xl={span / 5}
        >
            <Card
                onClick={() => onClick?.()}
                sx={(theme) => ({
                    aspectRatio: '16/9',
                    cursor: onClick ? 'pointer' : 'default',
                    transition: theme.transitions.create(['border-color', 'background-color'], { duration: 120 }),
                    '&:hover': onClick ? {
                        borderColor: alpha(theme.palette.primary.main, 0.45),
                        bgcolor: theme.palette.surface.elevated,
                    } : undefined,
                })}
            >
                <Stack
                    height="100%"
                    direction="column"
                    alignItems="center"
                    justifyContent="center"
                    gap={1}
                >
                    <FolderOutlinedIcon sx={{ color: 'text.secondary', fontSize: 28 }} />
                    <Typography variant="body1" sx={{ color: 'text.primary', wordBreak: 'break-word', textAlign: 'center', px: 1 }}>
                        {name}
                    </Typography>
                </Stack>
            </Card>
        </Grid>
    );
};


interface MediaViewProps {
    columns?: number;
    onClipSelect?: (clip: MediaDoc) => void;
    prefix?: string;

    showAsDirectories?: boolean;
    onNavigate?: (path: string) => void;

    onClipDelete?: (clip: MediaDoc) => void;
    onClipRename?: (clip: MediaDoc) => void;
}

export const MediaView: React.FC<MediaViewProps> = ({
    columns,
    onClipSelect,
    prefix,
    showAsDirectories,
    onNavigate,
    onClipDelete,
    onClipRename,
}) => {
    const socket = useSocket();
    const [media, setMedia] = useState<MediaDoc[]>([]);

    const folders = useMemo(() => {
        const folders = new Set<string>();

        media
            .filter(media => media.id.startsWith(prefix ?? ''))
            .map(media => media.id.substring(prefix?.length ?? 0).split('/'))
            .filter(parts => parts.length > 1)
            .forEach(parts => folders.add(parts[0]));

        return [...folders.values()];
    }, [media, prefix]);

    const data = useMemo(() =>
        media
            .filter(media => media.id.startsWith(prefix ?? ''))
            .map(media => {
                const background = media._attachments['thumb.png'];
                const url = background ? `data:${background.content_type};base64,${Buffer.from(background.data).toString('base64')}` : 'https://via.placeholder.com/1920x1080';

                return {
                    name: media.id.substring(prefix?.length ?? 0),
                    duration: media.mediainfo.format.duration,
                    backgroundUrl: url,
                };
            })
            .filter(media => !showAsDirectories || media.name.indexOf('/') < 0),
    [media, prefix],
    );

    useEffect(() => {
        const load = () => socket.caspar
            .getMedia()
            .then(media => setMedia([...media.values()]))
            .catch(console.error);

        load();
        socket.caspar.on('media', load);

        return () => void socket.caspar.off('media', load);
    }, []);

    return (
        <Stack>
            {
                (data.length || folders.length) ? (
                    <Grid container spacing={2}>
                        {
                            data.map((clip, index) => (
                                <MediaCard
                                    key={clip.name}
                                    {...clip}
                                    columns={columns}
                                    onClick={onClipSelect ? () => onClipSelect(media[index]) : undefined}
                                    onDelete={onClipDelete ? () => onClipDelete(media[index]) : undefined}
                                    onRename={onClipRename ? () => onClipRename(media[index]) : undefined}
                                />
                            ))
                        }

                        {
                            showAsDirectories && folders.map(folder => (
                                <MediaFolder
                                    key={folder}
                                    name={folder}
                                    columns={columns}
                                    onClick={() => onNavigate?.(folder)}
                                />
                            ))
                        }
                    </Grid>
                ) : (
                    <Stack
                        direction="column"
                        alignItems="center"
                        justifyContent="center"
                        sx={{ py: 6 }}
                        spacing={0.5}
                    >
                        <Typography variant="h3" sx={{ color: 'text.secondary' }}>
                            No media
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                            Upload files from the Media page to make them available here.
                        </Typography>
                    </Stack>
                )
            }
        </Stack>
    );
};

interface MediaSelectProps {
    clip?: MediaDoc | null;
    onClipSelect: (clip: MediaDoc) => void;
}

export const MediaSelect: React.FC<MediaSelectProps> = ({clip, onClipSelect}) => {
    const [open, setOpen] = useState<boolean>(false);
    const data = useMemo(() => {
        if (!clip || !clip.id) return null;

        const background = clip._attachments?.['thumb.png'];
        const url = background
            ? `data:${background.content_type};base64,${Buffer.from(background.data).toString('base64')}`
            : 'https://via.placeholder.com/1920x1080';

        return {
            name: clip.id,
            duration: clip.mediainfo?.format?.duration ?? 0,
            backgroundUrl: url,
        };
    }, [clip]);

    return (
        <>
            <Stack spacing={1}>
                {data ? (
                    <MediaCard
                        {...data}
                        columns={1}
                        onClick={() => setOpen(true)}
                    />
                ) : (
                    <Box
                        onClick={() => setOpen(true)}
                        sx={(theme) => ({
                            aspectRatio: '16/9',
                            border: `1px dashed ${theme.palette.divider}`,
                            borderRadius: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: theme.transitions.create(['border-color', 'background-color'], { duration: 120 }),
                            '&:hover': {
                                borderColor: alpha(theme.palette.primary.main, 0.45),
                                bgcolor: theme.palette.surface.elevated,
                            },
                        })}
                    >
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            No media selected — click to choose
                        </Typography>
                    </Box>
                )}
                <Button
                    variant="outlined"
                    color="inherit"
                    size="small"
                    onClick={() => setOpen(true)}
                >
                    {data ? 'Change media' : 'Select media'}
                </Button>
            </Stack>

            <Modal open={open} onClose={() => setOpen(false)}>
                <Card
                    sx={(theme) => ({
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',

                        width: 'min(1100px, 85vw)',
                        height: 'min(720px, 75vh)',
                        display: 'flex',
                        flexDirection: 'column',

                        bgcolor: theme.palette.surface.elevated,
                        border: `1px solid ${theme.palette.divider}`,
                    })}
                >
                    <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        gap={2}
                        sx={(theme) => ({
                            px: 3,
                            py: 2,
                            borderBottom: `1px solid ${theme.palette.divider}`,
                            flexShrink: 0,
                        })}
                    >
                        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                            <Typography variant="h3">Select media</Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                Pick a clip from the CasparCG media library.
                            </Typography>
                        </Stack>
                        <Tooltip title="Close">
                            <IconButton onClick={() => setOpen(false)} sx={{ color: 'text.secondary' }}>
                                <CloseRoundedIcon />
                            </IconButton>
                        </Tooltip>
                    </Stack>

                    <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 3 }}>
                        <MediaView columns={4} onClipSelect={clip => {
                            setOpen(false);
                            onClipSelect?.(clip);
                        }} />
                    </Box>
                </Card>
            </Modal>
        </>
    );
};
