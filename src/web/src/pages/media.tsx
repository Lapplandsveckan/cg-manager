import {DefaultContentLayout} from '../components/DefaultContentLayout';
import {Card, Stack, Typography} from '@mui/material';
import {UploadButton} from '../components/Upload';
import React, {useEffect} from 'react';
import {MediaView} from '../components/MediaView';
import {useSocket} from '../lib';
import {useRouter} from 'next/router';

const Page = () => {
    const socket = useSocket();
    const router = useRouter();

    const [path, setPath] = React.useState<string>('');

    const navigate = (path: string) => {
        setPath(path);
        router.push({
            query: { ...router.query, path },
        });
    };

    useEffect(() => setPath(router.query.path as string ?? ''), [router.query.path]);

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
                        createUpload={file => socket.caspar.uploadMedia(path + file.name, file)}
                    />
                </Stack>
            </Card>
            <MediaView
                prefix={path}
                showAsDirectories
                onNavigate={folder => navigate(`${path}${folder}/`)}
            />
        </DefaultContentLayout>
    );
};

export default Page;