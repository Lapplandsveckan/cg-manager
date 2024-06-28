import React from 'react';
import {Card, IconButton, Modal, Typography} from '@mui/material';
import {uploadFile} from '../lib/api/upload';
import {noTryAsync} from 'no-try';
import {showOpenFilePicker, ShowOpenFilePickerOptions} from '../lib/filePicker';
import {CloudUploadRounded} from '@mui/icons-material';

interface UploadButtonProps {
    types: ShowOpenFilePickerOptions['types'];
    createUpload: (file: File) => Promise<string>;
}

export const UploadButton: React.FC<UploadButtonProps> = ({ types, createUpload }) => {
    const [open, setOpen] = React.useState(false);
    const [upload, setUpload] = React.useState<(() => unknown) | null>(null);
    const [progress, setProgress] = React.useState<number | null>(null); // [0, 100]
    const [error, setError] = React.useState<string | null>(null);

    return (
        <>
            <IconButton
                sx={{
                    color: '#fff',
                }}
                onClick={async () => {
                    if (upload) return;

                    const [e, files] = await noTryAsync(() => showOpenFilePicker({ types }));
                    if (e) return;

                    setOpen(true);
                    const [err, file] = await noTryAsync(() => files[0].getFile());
                    if (err || !file) {
                        setError(err?.message ?? 'File not found');
                        return;
                    }

                    const id = await createUpload(file);

                    const [promise, cancel] = uploadFile(
                        id,
                        file,
                        progress => setProgress(Math.round(progress * 100)),
                    );

                    setUpload(() => cancel);
                    const [error] = await noTryAsync(() => promise);

                    if (error) setError(error.message);
                    setUpload(null);
                }}
            >
                <CloudUploadRounded />
            </IconButton>

            <Modal
                open={open}
                onClose={() => {
                    setOpen(false);
                    if (upload) upload(); // cancel upload
                }}
                aria-labelledby="parent-modal-title"
                aria-describedby="parent-modal-description"
            >
                <Card
                    sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',

                        width: 600,
                        height: 400,

                        transform: 'translate(-50%, -50%)',

                        bgcolor: '#47575a',
                        p: 4,
                    }}
                >
                    <Typography id="parent-modal-title" variant="h6" component="h2">
                        Upload
                    </Typography>
                    <Typography id="parent-modal-description" variant="body1" component="p" color={error ? 'error' : 'initial'}>
                        {
                            upload ? `Uploading... ${progress ? `${progress}%` : ''}` :
                                error ? `Error: ${error}`
                                    : 'Successfully uploaded'
                        }
                    </Typography>
                </Card>
            </Modal>
        </>
    );
};