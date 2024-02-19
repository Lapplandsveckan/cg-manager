import {Grid, Stack} from '@mui/material';
import {useSocket} from '../lib/hooks/useSocket';
import React, {useEffect, useMemo, useState} from 'react';
import {MediaDoc} from '../lib/api/caspar';
import {getDurationString, MediaCard} from '../components/MediaCard';

export const MediaView: React.FC = () => {
    const socket = useSocket();
    const [media, setMedia] = useState<MediaDoc[]>([]);

    const data = useMemo(() => media.map(media => {
        const background = media._attachments['thumb.png'];
        const url = background ? `data:${background.content_type};base64,${Buffer.from(background.data).toString('base64')}` : 'https://via.placeholder.com/1920x1080';
        const duration = getDurationString(media.mediainfo.format.duration);

        return {
            name: media.id,
            duration,
            backgroundUrl: url,
        };
    }), [media]);

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
            <Grid container spacing={2}>
                {
                    data.map(media => (
                        <MediaCard
                            key={media.name}
                            {...media}
                        />
                    ))
                }
            </Grid>
        </Stack>
    );
};