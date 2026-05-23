import {DefaultContentLayout} from '../components/DefaultContentLayout';
import {Box, Button, Card, Modal, Stack, TextField, Typography, alpha} from '@mui/material';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import CreateNewFolderRoundedIcon from '@mui/icons-material/CreateNewFolderRounded';
import {UploadButton, Dropzone, UploadModal, useFileUpload} from '../components/Upload';
import React, {useEffect, useState} from 'react';
import {MediaView} from '../components/MediaView';
import {useSocket} from '../lib';
import {useRouter} from 'next/router';
import {MediaDoc} from '../lib/api/caspar';
import {noTryAsync} from 'no-try';
import {useTranslation} from 'next-i18next';

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
    // `path` should always be a string from the page's state but the
    // upstream `router.query.path` can transiently be `undefined` (before
    // hydration) or `string[]` (`?path=a&path=b`); coerce defensively so
    // a stray shape can't crash the page.
    const safePath = typeof path === 'string' ? path : '';
    const segments = safePath.split('/').filter(Boolean);

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
    const {t} = useTranslation('common');
    const socket = useSocket();
    const router = useRouter();

    const [path, setPath] = useState<string>('');
    const [deleting, setDeleting] = useState<MediaDoc | null>(null);
    const [renaming, setRenaming] = useState<MediaDoc | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [creatingFolder, setCreatingFolder] = useState(false);
    const [folderName, setFolderName] = useState('');
    // Folder name (no trailing slash, relative to current `path`) the user
    // has asked to delete. Modal stays open until they confirm or cancel.
    const [deletingFolder, setDeletingFolder] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const navigate = (next: string) => {
        setPath(next);
        router.push({ query: { ...router.query, path: next } });
    };

    useEffect(() => {
        // `router.query.path` is either `string`, `string[]` (when the same
        // key appears multiple times), or `undefined`. The page state is
        // always a single string — flatten arrays by joining segments back,
        // empty otherwise.
        const raw = router.query.path;
        const next = typeof raw === 'string'
            ? raw
            : Array.isArray(raw) ? raw.join('/') : '';
        setPath(next);
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
            setError((e as Error)?.message ?? t('media.errors.deleteFailed'));
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
            setError((e as Error)?.message ?? t('media.errors.renameFailed'));
        } finally {
            setBusy(false);
        }
    };

    const confirmDeleteFolder = async () => {
        if (!socket || !deletingFolder) return;
        setBusy(true);
        setError(null);
        const target = `${path}${deletingFolder}`;
        const [err] = await noTryAsync(() => socket.caspar.deleteFolder(target));
        setBusy(false);
        if (err) {
            // The server returns 409 ("Folder is not empty (N items)") when
            // the user has media or sub-folders inside. Surface that text
            // verbatim — it tells them why they can't delete.
            setError(err.message ?? t('media.errors.deleteFolderFailed'));
            return;
        }
        setDeletingFolder(null);
    };

    const confirmCreateFolder = async () => {
        if (!socket) return;
        const name = folderName.trim();
        if (!name) return;
        setBusy(true);
        setError(null);
        // Path is rooted at the folder we're currently viewing — keeps the
        // operator's mental model "create here" rather than asking them to
        // type the absolute path.
        const target = `${path}${name}`;
        const [err, res] = await noTryAsync(() => socket.caspar.createFolder(target));
        setBusy(false);
        if (err || !res) {
            setError(err?.message ?? t('media.errors.createFolderFailed'));
            return;
        }
        setCreatingFolder(false);
        setFolderName('');
        // Drop the user inside the freshly-created folder — that's almost
        // always what they want next.
        navigate(res.path);
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
                fill
                onDrop={uploadCtrl.start}
                accept={['video/*', 'audio/*', 'image/*']}
                disabled={uploadCtrl.state.phase === 'starting' || uploadCtrl.state.phase === 'uploading'}
                overlayLabel={t('media.page.dropOverlay', {path: path || '/'})}
            >
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={2} mb={1}>
                    <Stack spacing={1}>
                        <Typography variant="h1">{t('media.page.title')}</Typography>
                        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                            {t('media.page.subtitle')}
                        </Typography>
                    </Stack>
                    <Stack direction="row" gap={1}>
                        <Button
                            color="inherit"
                            startIcon={<CreateNewFolderRoundedIcon />}
                            onClick={() => {
                                setError(null);
                                setFolderName('');
                                setCreatingFolder(true);
                            }}
                        >
                            {t('media.page.newFolder')}
                        </Button>
                        <UploadButton
                            label={t('media.page.uploadMedia')}
                            controller={uploadCtrl}
                            types={[
                                {
                                    description: t('media.page.mediaFiles'),
                                    accept: {
                                        'audio/*': ['mp3', 'wav', 'ogg'],
                                        'video/*': ['mp4', 'webm', 'mkv'],
                                        'image/*': ['png', 'jpg', 'jpeg', 'gif'],
                                    },
                                },
                            ]}
                        />
                    </Stack>
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
                    onFolderDelete={(folder) => { setError(null); setDeletingFolder(folder); }}
                />
            </Dropzone>

            <UploadModal
                state={uploadCtrl.state}
                onClose={uploadCtrl.reset}
                onCancel={uploadCtrl.cancel}
                onConfirm={uploadCtrl.confirm}
                // Plugin injections in the modal (e.g. the encode
                // plugin's "Skip encoding" checkbox) need to know
                // the absolute path the file will land at server-side.
                // The scanner stores them upper-cased, so match that.
                targetPathFor={(file) => `${path}${file.name}`}
            />

            <Modal open={Boolean(deleting)} onClose={() => !busy && setDeleting(null)}>
                <ModalCard>
                    <Stack spacing={2}>
                        <Stack direction="row" alignItems="center" gap={1.5}>
                            <WarningAmberRoundedIcon sx={{ color: '#e88c8c' }} />
                            <Typography variant="h3">{t('media.deleteMedia.title')}</Typography>
                        </Stack>
                        <Typography variant="body1" sx={{ color: 'text.secondary', wordBreak: 'break-all' }}>
                            <strong style={{ color: 'inherit' }}>{deleting?.id}</strong>{' '}
                            {t('media.deleteMedia.body')}
                        </Typography>
                        {error && <Typography variant="body2" color="error">{error}</Typography>}
                        <Stack direction="row" justifyContent="flex-end" gap={1}>
                            <Button onClick={() => setDeleting(null)} disabled={busy} color="inherit">
                                {t('actions.cancel')}
                            </Button>
                            <Button onClick={confirmDelete} disabled={busy} variant="contained" color="error">
                                {busy ? t('media.deleteMedia.deleting') : t('actions.delete')}
                            </Button>
                        </Stack>
                    </Stack>
                </ModalCard>
            </Modal>

            <Modal
                open={Boolean(deletingFolder)}
                onClose={() => { if (!busy) setDeletingFolder(null); }}
            >
                <ModalCard>
                    <Stack spacing={2}>
                        <Stack direction="row" alignItems="center" gap={1.5}>
                            <WarningAmberRoundedIcon sx={{ color: '#e88c8c' }} />
                            <Typography variant="h3">{t('media.deleteFolder.title')}</Typography>
                        </Stack>
                        <Typography variant="body1" sx={{ color: 'text.secondary', wordBreak: 'break-all' }}>
                            <strong style={{ color: 'inherit' }}>{path}{deletingFolder}</strong>{' '}
                            {t('media.deleteFolder.body')}
                        </Typography>
                        {error && <Typography variant="body2" color="error">{error}</Typography>}
                        <Stack direction="row" justifyContent="flex-end" gap={1}>
                            <Button onClick={() => setDeletingFolder(null)} disabled={busy} color="inherit">
                                {t('actions.cancel')}
                            </Button>
                            <Button
                                onClick={confirmDeleteFolder}
                                disabled={busy}
                                variant="contained"
                                color="error"
                            >
                                {busy ? t('media.deleteMedia.deleting') : t('actions.delete')}
                            </Button>
                        </Stack>
                    </Stack>
                </ModalCard>
            </Modal>

            <Modal
                open={creatingFolder}
                onClose={() => { if (!busy) { setCreatingFolder(false); setFolderName(''); } }}
            >
                <ModalCard>
                    <Stack spacing={2}>
                        <Stack direction="row" alignItems="center" gap={1.5}>
                            <CreateNewFolderRoundedIcon sx={{ color: 'primary.main' }} />
                            <Typography variant="h3">{t('media.createFolder.title')}</Typography>
                        </Stack>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {t('media.createFolder.bodyBefore')}{' '}
                            <strong>{path || '/'}</strong>{t('media.createFolder.bodyBetween')}{' '}
                            <code>/</code>{t('media.createFolder.bodyAfter')}
                        </Typography>
                        <TextField
                            label={t('media.createFolder.nameLabel')}
                            value={folderName}
                            onChange={(e) => setFolderName(e.target.value)}
                            autoFocus
                            disabled={busy}
                            onKeyDown={(e) => { if (e.key === 'Enter') confirmCreateFolder(); }}
                        />
                        {error && <Typography variant="body2" color="error">{error}</Typography>}
                        <Stack direction="row" justifyContent="flex-end" gap={1}>
                            <Button
                                onClick={() => { setCreatingFolder(false); setFolderName(''); }}
                                disabled={busy}
                                color="inherit"
                            >
                                {t('actions.cancel')}
                            </Button>
                            <Button
                                onClick={confirmCreateFolder}
                                disabled={busy || !folderName.trim()}
                                variant="contained"
                            >
                                {busy ? t('media.createFolder.creating') : t('actions.create')}
                            </Button>
                        </Stack>
                    </Stack>
                </ModalCard>
            </Modal>

            <Modal open={Boolean(renaming)} onClose={() => !busy && setRenaming(null)}>
                <ModalCard>
                    <Stack spacing={2}>
                        <Typography variant="h3">{t('media.renameMedia.title')}</Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {t('media.renameMedia.body')}
                        </Typography>
                        <TextField
                            label={t('media.renameMedia.nameLabel')}
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
                                {t('actions.cancel')}
                            </Button>
                            <Button onClick={confirmRename} disabled={busy} variant="contained">
                                {busy ? t('media.renameMedia.renaming') : t('actions.rename')}
                            </Button>
                        </Stack>
                    </Stack>
                </ModalCard>
            </Modal>
        </DefaultContentLayout>
    );
};

export default Page;
