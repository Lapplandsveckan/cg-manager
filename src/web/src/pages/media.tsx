import {DefaultContentLayout} from '../components/DefaultContentLayout';
import {Card, Stack, Typography} from '@mui/material';
import {UploadButton} from '../components/Upload';
import React from 'react';
import {MediaView} from '../components/MediaView';
import {useSocket} from '../lib';

const Page = () => {
    const socket = useSocket();

    return (
        <DefaultContentLayout>
            <Typography
                fontSize="32px"
                fontWeight={600}
                marginBottom="20px"
                variant="h1"
            >
                Media
            </Typography>
            <Card
                sx={{
                    padding: '10px',
                    backgroundColor: '#47575a',
                    marginBottom: '20px',
                }}
            >
                <Stack direction="row" alignItems="center" justifyContent="space-between" height="100%">
                    <Typography fontSize="20px" color="white">Upload</Typography>
                    <UploadButton
                        types={[
                            {
                                description: 'Media files',
                                accept: {
                                    audio: ['mp3', 'wav', 'ogg'],
                                    video: ['mp4', 'webm', 'mkv'],
                                    image: ['png', 'jpg', 'jpeg', 'gif'],
                                },
                            },
                        ]}
                        createUpload={file => socket.caspar.uploadMedia(file.name, file)}
                    />
                </Stack>
            </Card>
            <MediaView />
        </DefaultContentLayout>
    );
};

export default Page;