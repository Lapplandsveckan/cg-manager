import {Box, Button, Card, Grid, IconButton, Modal, Stack, Tooltip, Typography, alpha} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import {useSocket} from '../lib/hooks/useSocket';
import React, {useEffect, useMemo, useState} from 'react';
import {MediaDoc} from '../lib/api/caspar';
import {MediaCard} from '../components/MediaCard';
import {useTranslation} from 'next-i18next';


export interface MediaFolderProps {
    name: string;

    columns?: number;
    onClick?: () => void;
    onDelete?: () => void;
}

export const MediaFolder: React.FC<MediaFolderProps> = ({name, columns, onClick, onDelete}) => {
    const {t} = useTranslation('common');
    const span = 60 / (columns ?? 5);

    return (
        <Grid
            item xs={span} sm={span / 2} md={span / 3} lg={span / 4} xl={span / 5}
        >
            <Card
                onClick={() => onClick?.()}
                sx={(theme) => ({
                    position: 'relative',
                    aspectRatio: '16/9',
                    cursor: onClick ? 'pointer' : 'default',
                    transition: theme.transitions.create(['border-color', 'background-color'], { duration: 120 }),
                    '&:hover': onClick ? {
                        borderColor: alpha(theme.palette.primary.main, 0.45),
                        bgcolor: theme.palette.surface.elevated,
                    } : undefined,
                    '&:hover .media-folder-actions': onDelete ? { opacity: 1 } : {},
                })}
            >
                {onDelete && (
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
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Tooltip title={t('media.folder.deleteTooltip')}>
                            <IconButton
                                size="small"
                                onClick={onDelete}
                                sx={{ color: '#e88c8c' }}
                            >
                                <DeleteOutlineRoundedIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                )}
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
    /** Called with the folder name (single segment, no trailing slash)
     *  when the user clicks the trash icon on a folder card. Caller is
     *  responsible for confirmation + invoking deleteFolder on the API. */
    onFolderDelete?: (folder: string) => void;
}

export const MediaView: React.FC<MediaViewProps> = ({
    columns,
    onClipSelect,
    prefix,
    showAsDirectories,
    onNavigate,
    onClipDelete,
    onClipRename,
    onFolderDelete,
}) => {
    const {t} = useTranslation('common');
    const socket = useSocket();
    const [media, setMedia] = useState<MediaDoc[]>([]);
    // Folders are tracked separately from the media listing because the
    // scanner only indexes files — an empty folder created by the user
    // would otherwise be invisible. Server returns upper-cased prefixes
    // with trailing slashes (e.g. `INTRO/CONCERTS/`).
    const [serverFolders, setServerFolders] = useState<string[]>([]);

    const folders = useMemo(() => {
        const set = new Set<string>();
        const p = prefix ?? '';

        // File-derived folders: any media inside this prefix that has more
        // path after the prefix.
        media
            .filter(media => media.id.startsWith(p))
            .map(media => media.id.substring(p.length).split('/'))
            .filter(parts => parts.length > 1)
            .forEach(parts => set.add(parts[0]));

        // Server-listed folders (covers empty ones the scanner can't see).
        serverFolders
            .filter(f => f.startsWith(p) && f.length > p.length)
            .map(f => f.substring(p.length).split('/').filter(Boolean))
            .forEach(parts => { if (parts.length > 0) set.add(parts[0]); });

        return [...set.values()];
    }, [media, serverFolders, prefix]);

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
        const loadMedia = () => socket.caspar
            .getMedia()
            .then(media => setMedia([...media.values()]))
            .catch(console.error);

        const loadFolders = () => socket.caspar
            .getFolders()
            .then(setServerFolders)
            .catch(console.error);

        loadMedia();
        loadFolders();

        // Media updates also probably implies new folders (uploads create
        // directories implicitly); refresh both on the broadcast.
        const onMedia = () => { loadMedia(); loadFolders(); };
        const onFolders = () => loadFolders();
        socket.caspar.on('media', onMedia);
        socket.caspar.on('folders', onFolders);

        return () => {
            socket.caspar.off('media', onMedia);
            socket.caspar.off('folders', onFolders);
        };
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
                                    onDelete={onFolderDelete ? () => onFolderDelete(folder) : undefined}
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
                            {t('media.empty.title')}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                            {t('media.empty.detail')}
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

const MediaSelectCrumb: React.FC<{
    label: React.ReactNode;
    onClick: () => void;
    active?: boolean;
}> = ({ label, onClick, active }) => (
    <Box
        component="button"
        onClick={onClick}
        sx={(theme) => ({
            appearance: 'none',
            background: 'transparent',
            border: 'none',
            padding: '4px 8px',
            borderRadius: 1,
            cursor: 'pointer',
            color: active ? theme.palette.text.primary : theme.palette.text.secondary,
            fontWeight: active ? 600 : 400,
            fontSize: '0.8125rem',
            lineHeight: 1.4,
            display: 'inline-flex',
            alignItems: 'center',
            '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                color: theme.palette.text.primary,
            },
        })}
    >
        {label}
    </Box>
);

interface MediaSelectBreadcrumbProps {
    path: string;
    onNavigate: (next: string) => void;
}

const MediaSelectBreadcrumb: React.FC<MediaSelectBreadcrumbProps> = ({ path, onNavigate }) => {
    const segments = path.split('/').filter(Boolean);
    return (
        <Stack direction="row" alignItems="center" gap={0.25} flexWrap="wrap">
            <MediaSelectCrumb
                label={<HomeRoundedIcon fontSize="small" sx={{ display: 'block' }} />}
                onClick={() => onNavigate('')}
                active={segments.length === 0}
            />
            {segments.map((segment, index) => (
                <React.Fragment key={index}>
                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>/</Typography>
                    <MediaSelectCrumb
                        label={segment}
                        onClick={() => onNavigate(`${segments.slice(0, index + 1).join('/')}/`)}
                        active={index === segments.length - 1}
                    />
                </React.Fragment>
            ))}
        </Stack>
    );
};

export const MediaSelect: React.FC<MediaSelectProps> = ({clip, onClipSelect}) => {
    const {t} = useTranslation('common');
    const [open, setOpen] = useState<boolean>(false);
    const [path, setPath] = useState<string>('');

    // Reset the folder navigation each time the modal reopens so picking again
    // doesn't drop the user wherever they last browsed.
    useEffect(() => {
        if (!open) setPath('');
    }, [open]);

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
                            {t('media.select.empty')}
                        </Typography>
                    </Box>
                )}
                <Button
                    variant="outlined"
                    color="inherit"
                    size="small"
                    onClick={() => setOpen(true)}
                >
                    {data ? t('media.select.change') : t('media.select.select')}
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
                            <Typography variant="h3">{t('media.select.modalTitle')}</Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                {t('media.select.modalSubtitle')}
                            </Typography>
                        </Stack>
                        <Tooltip title={t('actions.close')}>
                            <IconButton onClick={() => setOpen(false)} sx={{ color: 'text.secondary' }}>
                                <CloseRoundedIcon />
                            </IconButton>
                        </Tooltip>
                    </Stack>

                    <Box
                        sx={(theme) => ({
                            px: 3,
                            py: 1,
                            borderBottom: `1px solid ${theme.palette.divider}`,
                            flexShrink: 0,
                        })}
                    >
                        <MediaSelectBreadcrumb path={path} onNavigate={setPath} />
                    </Box>

                    <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 3 }}>
                        <MediaView
                            columns={4}
                            prefix={path}
                            showAsDirectories
                            onNavigate={folder => setPath(`${path}${folder}/`)}
                            onClipSelect={clip => {
                                setOpen(false);
                                onClipSelect?.(clip);
                            }}
                        />
                    </Box>
                </Card>
            </Modal>
        </>
    );
};
