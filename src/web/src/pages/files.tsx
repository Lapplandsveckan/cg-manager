import {DefaultContentLayout} from '../components/DefaultContentLayout';
import {Card, TextField, Typography} from '@mui/material';
import {Upload, UploadContainer} from '../components/Upload';
import {useSocket} from '../lib/hooks/useSocket';
import {useState} from 'react';

const Page = () => {
    const socket = useSocket();
    const [path, setPath] = useState<string>('');

    return (
        <DefaultContentLayout>
            <h1>Files</h1>
            <Card
                sx={{
                    padding: '20px',
                    margin: '20px',

                    backgroundColor: '#47575a',
                }}
            >
                <Typography fontSize="30px" color="white">Upload</Typography>
                <TextField
                    label="Path"
                    value={path}
                    onChange={e => setPath(e.target.value)}
                />
                <Upload
                    accept="image/*, video/*"
                    fileEnding={['gif', 'jpg', 'png', 'mp4', 'mkv']}
                    title="Upload a file"
                    createUpload={file => socket.caspar.uploadMedia(path, file)}
                    onFile={file => !path && setPath(file.name)}
                />
            </Card>
        </DefaultContentLayout>
    );
};

export default Page;