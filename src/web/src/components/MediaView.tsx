import {Button, Card, Grid, Modal, Stack, Typography} from '@mui/material';
import {useSocket} from '../lib/hooks/useSocket';
import React, {useEffect, useMemo, useState} from 'react';
import {MediaDoc} from '../lib/api/caspar';
import {MediaCard} from '../components/MediaCard';
import {Box} from '@mui/system';


export interface MediaFolderProps {
    name: string;

    columns?: number;
    onClick?: () => void;
}

export const MediaFolder: React.FC<MediaFolderProps> = ({name, columns, onClick}) => {
    columns = 60 / (columns ?? 5);

    return (
        <Grid
            item xs={columns} sm={columns / 2} md={columns / 3} lg={columns  / 4} xl={columns / 5}
            onClick={() => onClick?.()}
        >
            <Card
                sx={{
                    aspectRatio: '16/9',
                }}
            >
                <Stack height="100%" direction="column" alignItems="center" justifyContent="center">
                    <Typography fontSize="24px" color="#ccc">{name}</Typography>
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
}

export const MediaView: React.FC<MediaViewProps> = ({columns, onClipSelect, prefix, showAsDirectories, onNavigate}) => {
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
        [media, prefix]
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
        <Stack
            sx={{
                overflowY: 'auto',
            }}
        >
            {
                (data.length || folders.length) ? (
                    <Grid container spacing={2}>
                        {
                            data.map((clip, index) => (
                                <MediaCard
                                    key={clip.name}
                                    {...clip}
                                    columns={columns}
                                    onClick={() => onClipSelect?.(media[index])}
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
                        height="100%"
                    >
                        <h1>No media</h1>
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

        const background = clip._attachments['thumb.png'];
        const data = Buffer.from(background.data).toString('base64');
        const url = background ? `data:${background.content_type};base64,${data}` : 'https://via.placeholder.com/1920x1080';

        return {
            name: clip.id,
            duration: clip.mediainfo.format.duration,
            backgroundUrl: url,
        };
    }, [clip]);

    return (
        <>
            <Stack>
                <Button
                    onClick={() => {
                        setOpen(true);
                    }}
                >
                    Select Media
                </Button>

                {/* <Typography> */}
                {/*    {clip?.id ?? 'No media selected'} */}
                {/* </Typography> */}

                {
                    data ? (
                        <MediaCard
                            {...data}
                            columns={1}
                        />
                    ) : (
                        <Typography variant="body1">
                            No Media Selected
                        </Typography>
                    )
                }
            </Stack>
            <Modal
                open={open}
                onClose={() => {
                    setOpen(false);
                }}
            >
                <Stack
                    sx={{
                        position: 'absolute',

                        top: '50%',
                        left: '50%',

                        transform: 'translate(-50%, -50%)',

                        width: '100vw',
                        height: '100vh',
                    }}

                    alignItems="center"
                    justifyContent="center"
                >
                    <Box
                        m={4}
                        p={2}

                        sx={{
                            backgroundColor: '#272930',
                            borderRadius: 4,

                            width: '75%',
                            height: '60%',

                            overflowY: 'auto',
                        }}
                    >
                        <MediaView columns={4} onClipSelect={clip => {
                            setOpen(false);
                            onClipSelect?.(clip);
                        }} />
                    </Box>
                </Stack>
            </Modal>
        </>
    );
};