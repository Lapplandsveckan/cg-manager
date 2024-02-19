import React from 'react';
import {Button, Stack, Typography} from '@mui/material';
import {uploadFile} from '../lib/api/upload';
import {noTryAsync} from 'no-try';

interface UploadContainerProps {
    fileEnding: string[];
    accept: string;
    title: string;

    onFile: (file: File) => void;
}

export const UploadContainer: React.FC<UploadContainerProps> = ({ accept, title, fileEnding, onFile }) => {
    const [file, setFile] = React.useState<File | null>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const selectFile = (file: File) => {
        setFile(file);
        onFile(file);
    };

    // TODO: handle folders

    return (
        <Stack
            direction="column"
            alignItems="center"
            justifyContent="center"

            sx={{
                width: '500px',
                height: '500px',

                border: '2px dashed #777',
                borderRadius: '10px',

                cursor: 'pointer',
            }}

            onClick={() => inputRef.current?.click()}
            onDrop={e => {
                e.preventDefault();

                const file = e.dataTransfer.files[0];
                if (!file) return;

                const ext = file.name.split('.').pop();
                if (ext && fileEnding.includes(ext)) selectFile(file);
            }}
            onDragOver={e => e.preventDefault()}
        >
            <Typography>{file?.name ?? 'No file chosen'}</Typography>
            <input ref={inputRef} style={{ visibility: 'hidden' }} type="file" multiple={false} accept={accept} onChange={e => {
                const input = e.nativeEvent.target as HTMLInputElement;

                const file = input.files?.[0];
                if (!file) return;

                const ext = file.name.split('.').pop();
                if (ext && fileEnding.includes(ext)) selectFile(file);
            }} />
        </Stack>
    );
};

export const Upload: React.FC<UploadContainerProps & { createUpload: (file: File) => Promise<string> }> = props => {
    const { createUpload, onFile, ...rest } = props;
    const [file, setFile] = React.useState<File | null>(null);
    const [uploading, setUploading] = React.useState(false);
    const [progress, setProgress] = React.useState<number | null>(null); // [0, 100]
    const [error, setError] = React.useState<string | null>(null);

    return (
        <Stack>
            <UploadContainer {...rest} onFile={file => {
                setFile(file);
                onFile(file);
            }} />
            <Button
                disabled={!file}
                onClick={async () => {
                    if (!file || uploading) return;
                    setUploading(true);

                    const id = await createUpload(file);
                    const [error] = await noTryAsync(() =>
                        uploadFile(
                            id,
                            file,
                            progress => setProgress(Math.round(progress * 100))
                        )
                    );

                    if (error) setError(error.message);
                    setUploading(false);
                }}
            >
                Upload
            </Button>
            <Typography>
                {
                    uploading ? `Uploading... ${progress ? `${progress}%` : ''}` :
                    error ? `Error: ${error}` :
                    ''
                }
            </Typography>
        </Stack>
    );
}