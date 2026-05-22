import {DefaultContentLayout} from '../components/DefaultContentLayout';
import {Box, Button, Card, Modal, Stack, TextField, Typography, alpha} from '@mui/material';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import {UploadButton, Dropzone, UploadModal, useFileUpload} from '../components/Upload';
import React, {useEffect, useState} from 'react';
import {MediaView} from '../components/MediaView';
import {useSocket} from '../lib';
import {useRouter} from 'next/router';
import {MediaDoc} from '../lib/api/caspar';

interface CrumbProps {
    label: React.ReactNode;
    onClick: () => void;
    active?: boolean;
}

const Crumb: React.FC<CrumbProps> = ({ label, onClick, active }) => {
    return (
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
                fontSize: '0.875rem',
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
};

const PathBreadcrumb: React.FC<{ path: string; onNavigate: (next: string) => void }> = ({ path, onNavigate }) => {
    const segments = path.split('/').filter(Boolean);

    return (
        <Stack direction="row" alignItems="center" gap={0.5} flexWrap="wrap">
            <Crumb
                label={<HomeRoundedIcon fontSize="small" sx={{ display: 'block' }} />}
                onClick={() => onNavigate('')}
            />
            {segments.map((segment, index) => (
                <React.Fragment key={index}>
                    <Typography variant="body2" sx={{ color: 'text.disabled' }}>/</Typography>
                    <Crumb
                        label={segment}
                        onClick={() => onNavigate(`${segments.slice(0, index + 1).join('/')}/`)}
                        active={index === segments.length - 1}
                    />
                </React.Fragment>
            ))}
        </Stack>
    );
};

const ModalCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <Card
        sx={(theme) => ({
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 460,
            p: 3,
            bgcolor: theme.palette.surface.elevated,
            border: `1px solid ${theme.palette.divider}`,
        })}
    >
        {children}
    </Card>
);

function clipShortName(clip: MediaDoc): string {
    return clip.id.split('/').pop() ?? clip.id;
}

const Page = () => {
    const socket = useSocket();
    const router = useRouter();

    const [path, setPath] = useState<string>('');
    const [deleting, setDeleting] = useState<MediaDoc | null>(null);
    const [renaming, setRenaming] = useState<MediaDoc | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const navigate = (next: string) => {
        setPath(next);
        router.push({ query: { ...router.query, path: next } });
    };

    useEffect(() => {
        setPath(router.query.path as string ?? '');
    }, [router.query.path]);

    useEffect(() => {
        if (renaming) setRenameValue(clipShortName(renaming));
    }, [renaming]);

    const confirmDelete = async () => {
        if (!deleting || !socket) return;
        setBusy(true);
        setError(null);
        try {
            await socket.caspar.deleteMedia(deleting.id);
            setDeleting(null);
        } catch (e) {
            setError((e as Error)?.message ?? 'Failed to delete');
        } finally {
            setBusy(false);
        }
    };

    const confirmRename = async () => {
        if (!renaming || !socket) return;
        const next = renameValue.trim();
        if (!next || next === clipShortName(renaming)) {
            setRenaming(null);
            return;
        }
        setBusy(true);
        setError(null);
        try {
            await socket.caspar.renameMedia(renaming.id, next);
            setRenaming(null);
        } catch (e) {
            setError((e as Error)?.message ?? 'Failed to rename');
        } finally {
            setBusy(false);
        }
    };

    // Shared controller so the Upload button and the page-wide Dropzone feed
    // the same progress modal. Files dropped or picked land in the current
    // folder (`path`) — same as the existing button behaviour.
    const uploadCtrl = useFileUpload({
        createUpload: file => socket.caspar.uploadMedia(path + file.name, file),
    });

    return (
        <DefaultContentLayout>
            <Dropzone
                onDrop={uploadCtrl.start}
                accept={['video/*', 'audio/*', 'image/*']}
                disabled={uploadCtrl.state.phase === 'starting' || uploadCtrl.state.phase === 'uploading'}
                overlayLabel={`Drop to upload to ${path || '/'}`}
            >
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={2} mb={1}>
                    <Stack spacing={1}>
                        <Typography variant="h1">Media</Typography>
                        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                            Browse media on the CasparCG server and upload new files.
                        </Typography>
                    </Stack>
                    <UploadButton
                        label="Upload media"
                        controller={uploadCtrl}
                        types={[
                            {
                                description: 'Media files',
                                accept: {
                                    'audio/*': ['mp3', 'wav', 'ogg'],
                                    'video/*': ['mp4', 'webm', 'mkv'],
                                    'image/*': ['png', 'jpg', 'jpeg', 'gif'],
                                },
                            },
                        ]}
                    />
                </Stack>

                <Card sx={{ p: 1.5, mb: 3 }}>
                    <PathBreadcrumb path={path} onNavigate={navigate} />
                </Card>

                <MediaView
                    prefix={path}
                    showAsDirectories
                    onNavigate={folder => navigate(`${path}${folder}/`)}
                    onClipDelete={(clip) => { setError(null); setDeleting(clip); }}
                    onClipRename={(clip) => { setError(null); setRenaming(clip); }}
                />
            </Dropzone>

            <UploadModal
                state={uploadCtrl.state}
                onClose={uploadCtrl.reset}
                onCancel={uploadCtrl.cancel}
            />

            <Modal open={Boolean(deleting)} onClose={() => !busy && setDeleting(null)}>
                <ModalCard>
                    <Stack spacing={2}>
                        <Stack direction="row" alignItems="center" gap={1.5}>
                            <WarningAmberRoundedIcon sx={{ color: '#e88c8c' }} />
                            <Typography variant="h3">Delete media?</Typography>
                        </Stack>
                        <Typography variant="body1" sx={{ color: 'text.secondary', wordBreak: 'break-all' }}>
                            <strong style={{ color: 'inherit' }}>{deleting?.id}</strong> will be removed from the
                            CasparCG media folder. This can&apos;t be undone.
                        </Typography>
                        {error && <Typography variant="body2" color="error">{error}</Typography>}
                        <Stack direction="row" justifyContent="flex-end" gap={1}>
                            <Button onClick={() => setDeleting(null)} disabled={busy} color="inherit">
                                Cancel
                            </Button>
                            <Button onClick={confirmDelete} disabled={busy} variant="contained" color="error">
                                {busy ? 'Deleting…' : 'Delete'}
                            </Button>
                        </Stack>
                    </Stack>
                </ModalCard>
            </Modal>

            <Modal open={Boolean(renaming)} onClose={() => !busy && setRenaming(null)}>
                <ModalCard>
                    <Stack spacing={2}>
                        <Typography variant="h3">Rename media</Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            File extension is preserved automatically.
                        </Typography>
                        <TextField
                            label="New name"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            autoFocus
                            disabled={busy}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') confirmRename();
                            }}
                        />
                        {error && <Typography variant="body2" color="error">{error}</Typography>}
                        <Stack direction="row" justifyContent="flex-end" gap={1}>
                            <Button onClick={() => setRenaming(null)} disabled={busy} color="inherit">
                                Cancel
                            </Button>
                            <Button onClick={confirmRename} disabled={busy} variant="contained">
                                {busy ? 'Renaming…' : 'Rename'}
                            </Button>
                        </Stack>
                    </Stack>
                </ModalCard>
            </Modal>
        </DefaultContentLayout>
    );
};

export default Page;
