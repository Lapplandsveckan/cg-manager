import { Button, Card, Stack, Typography } from '@mui/material';
import CreateNewFolderRoundedIcon from '@mui/icons-material/CreateNewFolderRounded';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { noTryAsync } from 'no-try';
import { useTranslation } from 'next-i18next';
import {
    UploadButton,
    Dropzone,
    UploadModal,
    useFileUpload,
} from '../components/Upload';
import { MediaView } from '../components/MediaView';
import { PathBreadcrumb } from '../components/PathBreadcrumb';
import { useSocket } from '../lib';
import { type MediaDoc } from '../lib/api/caspar';
import { DefaultContentLayout } from '../components/DefaultContentLayout';
import DeleteMediaModal from '../components/media/DeleteMediaModal';
import DeleteFolderModal from '../components/media/DeleteFolderModal';
import CreateFolderModal from '../components/media/CreateFolderModal';
import RenameMediaModal from '../components/media/RenameMediaModal';
import RenameFolderModal from '../components/media/RenameFolderModal';
import { createMediaHandlers } from '../lib/media/mediaHandlers';
import MediaPlayModal from '../components/MediaPlayModal';
import { type RundownEntry } from '../components/Rundowns';

/** Mirrors RundownActionDescriptor on the server — keep in sync. */
interface RundownActionDescriptor {
    id: string;
    acceptsFiles: boolean;
}

/** Mirrors RundownFileMatchResult on the server — keep in sync. */
interface RundownFileMatchResult {
    actionId: string;
    payload: { type: string; data?: unknown; title?: string };
}

function clipShortName(clip: MediaDoc): string {
    return clip.id.split('/').pop() ?? clip.id;
}

const Page = () => {
    const { t } = useTranslation('common');
    const socket = useSocket();
    const router = useRouter();

    const [path, setPath] = useState<string>('');
    const [canPlay, setCanPlay] = useState(false);
    const [playEntry, setPlayEntry] = useState<RundownEntry | null>(null);
    const [deleting, setDeleting] = useState<MediaDoc | null>(null);
    const [renaming, setRenaming] = useState<MediaDoc | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [creatingFolder, setCreatingFolder] = useState(false);
    const [folderName, setFolderName] = useState('');
    const [deletingFolder, setDeletingFolder] = useState<string | null>(null);
    const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
    const [folderRenameValue, setFolderRenameValue] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handlers = createMediaHandlers({
        socket,
        path,
        t,
        setBusy,
        setError,
    });

    useEffect(() => {
        socket.rawRequest('/api/rundown/actions', 'GET', {})
            .then(res => {
                const descriptors: RundownActionDescriptor[] = res.data ?? [];
                setCanPlay(descriptors.some(d => d.acceptsFiles));
            })
            .catch(() => setCanPlay(false));
    }, []);

    const handlePlay = async (clip: MediaDoc) => {
        setError(null);
        const name = clip.id.split('/').pop() ?? clip.id;
        const streams = clip.mediainfo?.streams ?? [];
        const hasVideo = streams.some(s => s.codec?.type === 'video');
        const hasAudio = streams.some(s => s.codec?.type === 'audio');
        // Coarse MIME hint for action match predicates. When mediainfo hasn't
        // been scanned yet (no streams) we can't know the kind — fall back to
        // image/* as the least-surprising default rather than guessing video.
        const mimeType = hasVideo
            ? 'video/*'
            : hasAudio
                ? 'audio/*'
                : 'image/*';

        const [err, res] = await noTryAsync(() =>
            socket.rawRequest('/api/rundown/actions/match-media', 'ACTION', {
                mediaId: clip.id,
                name,
                type: mimeType,
            }),
        );
        if (err) {
            setError(t('media.play.failed'));
            return;
        }

        const matches: RundownFileMatchResult[] = res?.data ?? [];
        if (!matches.length) {
            setError(t('media.play.noAction'));
            return;
        }

        // If several actions accept this media we deliberately take the first;
        // the Media view has no picker UI (unlike the rundown drop flow).
        const { payload } = matches[0];
        setPlayEntry({
            id: Math.random().toString(36).substring(2, 11),
            title: payload.title ?? t('rundown.newItemDefaultTitle'),
            type: payload.type,
            data: payload.data ?? {},
        });
    };

    /** Move a media file to the given destination folder. `clipId` is the
     *  full media id (e.g. `INTRO/CLIP`); `folderFullPath` is the full
     *  target folder, no trailing slash, "" for root. Fire-and-forget —
     *  the scanner broadcasts media-removed + media-added on completion
     *  which refreshes the view automatically. */
    const handleMediaMove = async (clipId: string, folderFullPath: string) => {
        if (!socket) return;
        const basename = clipId.split('/').pop();
        if (!basename) return;
        const newPath = folderFullPath
            ? `${folderFullPath}/${basename}`
            : basename;
        // No-op if the clip is already in this folder.
        if (newPath === clipId) return;
        setError(null);
        const [err] = await noTryAsync(() =>
            socket.caspar.moveMedia(clipId, newPath),
        );
        if (err)
            setError((err as Error)?.message ?? t('media.errors.moveFailed'));
    };

    const navigate = (next: string) => {
        setPath(next);
        router.push({ query: { ...router.query, path: next } });
    };

    useEffect(() => {
        const raw = router.query.path;
        const next =
            typeof raw === 'string'
                ? raw
                : Array.isArray(raw)
                  ? raw.join('/')
                  : '';
        setPath(next);
    }, [router.query.path]);

    useEffect(() => {
        if (renaming) setRenameValue(clipShortName(renaming));
    }, [renaming]);

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
                disabled={
                    uploadCtrl.state.phase === 'starting' ||
                    uploadCtrl.state.phase === 'uploading'
                }
                overlayLabel={t('media.page.dropOverlay', {
                    path: path || '/',
                })}
            >
                <Stack
                    direction="row"
                    alignItems="flex-start"
                    justifyContent="space-between"
                    gap={2}
                    mb={1}
                >
                    <Stack spacing={1}>
                        <Typography variant="h1">
                            {t('media.page.title')}
                        </Typography>
                        <Typography
                            variant="body1"
                            sx={{ color: 'text.secondary' }}
                        >
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
                                        'image/*': [
                                            'png',
                                            'jpg',
                                            'jpeg',
                                            'gif',
                                        ],
                                    },
                                },
                            ]}
                        />
                    </Stack>
                </Stack>

                <Card sx={{ p: 1.5, mb: 3 }}>
                    <PathBreadcrumb
                        path={path}
                        onNavigate={navigate}
                        onMediaDrop={handleMediaMove}
                    />
                </Card>

                <MediaView
                    prefix={path}
                    showAsDirectories
                    onNavigate={folder => navigate(`${path}${folder}/`)}
                    onClipPlay={canPlay ? handlePlay : undefined}
                    onClipDelete={clip => {
                        setError(null);
                        setDeleting(clip);
                    }}
                    onClipRename={clip => {
                        setError(null);
                        setRenaming(clip);
                    }}
                    onFolderDelete={folder => {
                        setError(null);
                        setDeletingFolder(folder);
                    }}
                    onFolderRename={folder => {
                        setError(null);
                        setRenamingFolder(folder);
                        setFolderRenameValue(folder);
                    }}
                    onClipMoveToFolder={handleMediaMove}
                />
            </Dropzone>

            <UploadModal
                state={uploadCtrl.state}
                onClose={uploadCtrl.reset}
                onCancel={uploadCtrl.cancel}
                onConfirm={uploadCtrl.confirm}
                targetPathFor={file => `${path}${file.name}`}
            />

            <MediaPlayModal
                entry={playEntry}
                onClose={() => setPlayEntry(null)}
                onError={() => setError(t('media.play.failed'))}
            />

            <DeleteMediaModal
                open={Boolean(deleting)}
                deleting={deleting}
                busy={busy}
                error={error}
                onClose={() => setDeleting(null)}
                onConfirm={() =>
                    handlers.confirmDelete(deleting, () => setDeleting(null))
                }
            />

            <DeleteFolderModal
                open={Boolean(deletingFolder)}
                folderPath={path}
                folderName={deletingFolder}
                busy={busy}
                error={error}
                onClose={() => setDeletingFolder(null)}
                onConfirm={() =>
                    handlers.confirmDeleteFolder(deletingFolder, () =>
                        setDeletingFolder(null),
                    )
                }
            />

            <CreateFolderModal
                open={creatingFolder}
                folderName={folderName}
                currentPath={path}
                busy={busy}
                error={error}
                onClose={() => {
                    setCreatingFolder(false);
                    setFolderName('');
                }}
                onFolderNameChange={setFolderName}
                onConfirm={() =>
                    handlers.confirmCreateFolder(folderName, newPath => {
                        setCreatingFolder(false);
                        setFolderName('');
                        navigate(newPath);
                    })
                }
            />

            <RenameMediaModal
                open={Boolean(renaming)}
                renameValue={renameValue}
                busy={busy}
                error={error}
                onClose={() => setRenaming(null)}
                onRenameValueChange={setRenameValue}
                onConfirm={() =>
                    handlers.confirmRename(renaming, renameValue, () =>
                        setRenaming(null),
                    )
                }
            />

            <RenameFolderModal
                open={Boolean(renamingFolder)}
                folderRenameValue={folderRenameValue}
                busy={busy}
                error={error}
                onClose={() => setRenamingFolder(null)}
                onFolderRenameValueChange={setFolderRenameValue}
                onConfirm={() =>
                    handlers.confirmRenameFolder(
                        renamingFolder,
                        folderRenameValue,
                        () => setRenamingFolder(null),
                    )
                }
            />
        </DefaultContentLayout>
    );
};

export default Page;
