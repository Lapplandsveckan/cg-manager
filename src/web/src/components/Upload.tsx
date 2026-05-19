import React, {useEffect, useRef, useState} from 'react';
import {Box, Button, Card, LinearProgress, Modal, Stack, Typography, alpha} from '@mui/material';
import {CloudUploadRounded, CheckCircleRounded, ErrorOutlineRounded} from '@mui/icons-material';
import {uploadFile} from '../lib/api/upload';
import {noTryAsync} from 'no-try';
import {pickFiles, PickFilesOptions} from '../lib/filePicker';

type Phase = 'idle' | 'starting' | 'uploading' | 'done' | 'error';

interface UploadButtonProps {
    types: PickFilesOptions['types'];
    /** Creates the server-side upload and returns its id. Receives the picked File. */
    createUpload: (file: File) => Promise<string>;
    /** Optional label override for the button. */
    label?: string;
}

export const UploadButton: React.FC<UploadButtonProps> = ({ types, createUpload, label = 'Upload' }) => {
    const [phase, setPhase] = useState<Phase>('idle');
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);

    const cancelRef = useRef<(() => unknown) | null>(null);

    const reset = () => {
        setPhase('idle');
        setProgress(0);
        setError(null);
        setFileName(null);
        cancelRef.current = null;
    };

    const closeModal = () => {
        if (phase === 'uploading' && cancelRef.current) cancelRef.current();
        reset();
    };

    useEffect(() => () => { cancelRef.current?.(); }, []);

    const handleClick = async () => {
        if (phase === 'starting' || phase === 'uploading') return;

        const files = await pickFiles({ types });
        if (!files.length) return;
        const file = files[0];

        setFileName(file.name);
        setError(null);
        setProgress(0);
        setPhase('starting');

        const [createErr, id] = await noTryAsync(() => createUpload(file));
        if (createErr || !id) {
            setError(createErr?.message ?? 'Failed to start upload');
            setPhase('error');
            return;
        }

        const [promise, cancel] = uploadFile(
            id,
            file,
            p => setProgress(Math.round(p * 100)),
        );
        cancelRef.current = cancel;
        setPhase('uploading');

        const [uploadErr] = await noTryAsync(() => promise);
        if (uploadErr) {
            setError(uploadErr.message);
            setPhase('error');
        } else 
            setPhase('done');
        
        cancelRef.current = null;
    };

    const open = phase !== 'idle';

    return (
        <>
            <Button
                variant="contained"
                startIcon={<CloudUploadRounded />}
                onClick={handleClick}
                disabled={phase === 'starting' || phase === 'uploading'}
            >
                {label}
            </Button>

            <Modal open={open} onClose={closeModal}>
                <Card
                    sx={(theme) => ({
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',

                        width: 480,
                        p: 3,
                        bgcolor: theme.palette.surface.elevated,
                        border: `1px solid ${theme.palette.divider}`,
                    })}
                >
                    <UploadModalContent
                        phase={phase}
                        progress={progress}
                        error={error}
                        fileName={fileName}
                        onClose={closeModal}
                    />
                </Card>
            </Modal>
        </>
    );
};

const UploadModalContent: React.FC<{
    phase: Phase;
    progress: number;
    error: string | null;
    fileName: string | null;
    onClose: () => void;
}> = ({ phase, progress, error, fileName, onClose }) => {
    return (
        <Stack spacing={2}>
            <Stack direction="row" alignItems="center" gap={1.5}>
                <PhaseIcon phase={phase} />
                <Typography variant="h3">
                    {phase === 'starting' && 'Preparing upload…'}
                    {phase === 'uploading' && 'Uploading…'}
                    {phase === 'done' && 'Upload complete'}
                    {phase === 'error' && 'Upload failed'}
                </Typography>
            </Stack>

            {fileName && (
                <Typography variant="body2" sx={{ color: 'text.secondary', wordBreak: 'break-all' }}>
                    {fileName}
                </Typography>
            )}

            {phase === 'uploading' && (
                <Stack spacing={0.5}>
                    <LinearProgress variant="determinate" value={progress} />
                    <Typography variant="caption" sx={{ alignSelf: 'flex-end' }}>{progress}%</Typography>
                </Stack>
            )}

            {phase === 'starting' && <LinearProgress />}

            {phase === 'error' && error && (
                <Typography variant="body2" color="error" sx={{ wordBreak: 'break-word' }}>
                    {error}
                </Typography>
            )}

            <Stack direction="row" justifyContent="flex-end" gap={1}>
                <Button onClick={onClose} color="inherit">
                    {phase === 'uploading' ? 'Cancel' :
                        phase === 'starting' ? 'Close' :
                            'Done'}
                </Button>
            </Stack>
        </Stack>
    );
};

const PhaseIcon: React.FC<{ phase: Phase }> = ({ phase }) => {
    if (phase === 'done') return <CheckCircleRounded sx={{ color: '#5fc97a' }} />;
    if (phase === 'error') return <ErrorOutlineRounded color="error" />;
    return (
        <Box
            sx={(theme) => ({
                width: 24,
                height: 24,
                borderRadius: '50%',
                bgcolor: alpha(theme.palette.primary.main, 0.18),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            })}
        >
            <CloudUploadRounded fontSize="small" sx={{ color: 'primary.main' }} />
        </Box>
    );
};
