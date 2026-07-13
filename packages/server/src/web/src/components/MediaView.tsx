import { Button, Grid, Stack, Typography, alpha } from '@mui/material';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { useSocket } from '../lib/hooks/useSocket';
import { SlotErrorBoundary } from './SlotErrorBoundary';
import { type MediaDoc } from '../lib/api/caspar';
import { MediaCard } from '../components/MediaCard';
import { MediaFolder } from '../components/MediaFolder';
import { useToast } from '../components/ToastProvider';

// Re-export so callers that imported from MediaView before the split keep
// working.
export { MediaFolder } from '../components/MediaFolder';
export type { MediaFolderProps } from '../components/MediaFolder';

interface MediaViewProps {
    columns?: number;
    onClipSelect?: (clip: MediaDoc) => void;
    prefix?: string;

    showAsDirectories?: boolean;
    onNavigate?: (path: string) => void;

    onClipPlay?: (clip: MediaDoc) => void;
    onClipDelete?: (clip: MediaDoc) => void;
    onClipRename?: (clip: MediaDoc) => void;
    /** Called with the folder name (single segment, no trailing slash)
     *  when the user clicks the trash icon on a folder card. Caller is
     *  responsible for confirmation + invoking deleteFolder on the API. */
    onFolderDelete?: (folder: string) => void;
    /** Called when the user clicks the rename icon on a folder card. The
     *  string is the folder name (single segment, no trailing slash). */
    onFolderRename?: (folder: string) => void;
    /** When set, clips become draggable. The handler fires with the
     *  dragged clip's id and the destination folder's full id (relative
     *  to media root, no trailing slash). The page resolves both into a
     *  moveMedia call. */
    onClipMoveToFolder?: (clipId: string, folderFullPath: string) => void;
    /** Enables Ctrl/Cmd+click and Shift+click multi-select on media cards
     *  (files only — folders are still single-delete). No-op unless
     *  `onBulkDelete` is also provided. */
    enableSelection?: boolean;
    /** Called with the selected docs when the user confirms the bulk
     *  delete button in the selection bar. Caller owns confirmation. */
    onBulkDelete?: (docs: MediaDoc[]) => void;
}

export const MediaView: React.FC<MediaViewProps> = ({
    columns,
    onClipSelect,
    prefix,
    showAsDirectories,
    onNavigate,
    onClipPlay,
    onClipDelete,
    onClipRename,
    onFolderDelete,
    onFolderRename,
    onClipMoveToFolder,
    enableSelection,
    onBulkDelete,
}) => {
    const { t } = useTranslation('common');
    const socket = useSocket();
    const notify = useToast();
    const [media, setMedia] = useState<MediaDoc[]>([]);
    const selectionActive = Boolean(enableSelection && onBulkDelete);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [anchorIndex, setAnchorIndex] = useState<number | null>(null);
    // Folders are tracked separately from the media listing because the
    // scanner only indexes files — an empty folder created by the user
    // would otherwise be invisible. Server returns upper-cased prefixes
    // with trailing slashes (e.g. `INTRO/CONCERTS/`).
    const [serverFolders, setServerFolders] = useState<string[]>([]);

    const folders = useMemo(() => {
        const set = new Set<string>();
        const p = prefix ?? '';

        media
            .filter(media => media.id.startsWith(p))
            .map(media => media.id.substring(p.length).split('/'))
            .filter(parts => parts.length > 1)
            .forEach(parts => set.add(parts[0]));

        serverFolders
            .filter(f => f.startsWith(p) && f.length > p.length)
            .map(f => f.substring(p.length).split('/').filter(Boolean))
            .forEach(parts => {
                if (parts.length > 0) set.add(parts[0]);
            });

        return [...set.values()];
    }, [media, serverFolders, prefix]);

    const data = useMemo(
        () =>
            media
                .filter(m => m.id.startsWith(prefix ?? ''))
                .map(m => {
                    const background = m._attachments?.['thumb.png'];
                    const url = background
                        ? `data:${background.content_type};base64,${Buffer.from(background.data).toString('base64')}`
                        : 'https://via.placeholder.com/1920x1080';

                    return {
                        doc: m,
                        name: m.id.substring(prefix?.length ?? 0),
                        duration: m.mediainfo.format.duration,
                        backgroundUrl: url,
                    };
                })
                .filter(
                    item => !showAsDirectories || item.name.indexOf('/') < 0,
                ),
        [media, prefix],
    );

    // Drop selected ids that no longer appear in `data` — e.g. after a
    // successful bulk delete, or when the user navigates to a different
    // folder (whose clips are all "gone" from this view's perspective).
    useEffect(() => {
        setSelected(prev => {
            if (prev.size === 0) return prev;
            const ids = new Set(data.map(c => c.doc.id));
            const next = new Set([...prev].filter(id => ids.has(id)));
            return next.size === prev.size ? prev : next;
        });
        // A stale anchor could point at the wrong row once `data` reflows
        // (navigation, refresh, or the just-deleted rows dropping out).
        setAnchorIndex(null);
    }, [data]);

    const toggleSelected = (id: string) =>
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const selectRange = (from: number, to: number) => {
        const [start, end] = from < to ? [from, to] : [to, from];
        setSelected(prev => {
            const next = new Set(prev);
            for (let i = start; i <= end; i++) next.add(data[i].doc.id);
            return next;
        });
    };

    const handleClipClick = (
        e: React.MouseEvent,
        index: number,
        clip: MediaDoc,
    ) => {
        if (selectionActive && (e.metaKey || e.ctrlKey)) {
            toggleSelected(clip.id);
            setAnchorIndex(index);
            return;
        }
        if (selectionActive && e.shiftKey && anchorIndex !== null) {
            selectRange(anchorIndex, index);
            setAnchorIndex(index);
            return;
        }
        setSelected(new Set());
        setAnchorIndex(null);
        onClipSelect?.(clip);
    };

    useEffect(() => {
        const loadMedia = () =>
            socket.caspar
                .getMedia()
                .then(media => setMedia([...media.values()]))
                .catch(() => notify(t('media.errors.loadFailed'), 'error'));

        const loadFolders = () =>
            socket.caspar
                .getFolders()
                .then(setServerFolders)
                .catch(() => notify(t('media.errors.loadFailed'), 'error'));

        loadMedia();
        loadFolders();

        // Media updates also probably implies new folders (uploads create
        // directories implicitly); refresh both on the broadcast.
        const onMedia = () => {
            loadMedia();
            loadFolders();
        };
        const onFolders = () => loadFolders();
        socket.caspar.on('media', onMedia);
        socket.caspar.on('folders', onFolders);

        return () => {
            socket.caspar.off('media', onMedia);
            socket.caspar.off('folders', onFolders);
        };
    }, []);

    return (
        <Stack>
            {selectionActive && selected.size > 0 && (
                <SlotErrorBoundary label="media-selection-bar" silent>
                    <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        sx={theme => ({
                            mb: 1.5,
                            px: 1.5,
                            py: 1,
                            borderRadius: 1,
                            bgcolor: alpha(theme.palette.primary.main, 0.08),
                        })}
                    >
                        <Typography variant="body2">
                            {t('media.selection.count', {
                                count: selected.size,
                            })}
                        </Typography>
                        <Stack direction="row" gap={1}>
                            <Button
                                size="small"
                                color="inherit"
                                onClick={() => {
                                    setSelected(new Set());
                                    setAnchorIndex(null);
                                }}
                            >
                                {t('media.selection.clear')}
                            </Button>
                            <Button
                                size="small"
                                variant="contained"
                                color="error"
                                onClick={() =>
                                    onBulkDelete?.(
                                        data
                                            .filter(c => selected.has(c.doc.id))
                                            .map(c => c.doc),
                                    )
                                }
                            >
                                {t('media.selection.delete')}
                            </Button>
                        </Stack>
                    </Stack>
                </SlotErrorBoundary>
            )}
            {data.length || folders.length ? (
                <Grid container spacing={2}>
                    {data.map((clip, index) => (
                        <SlotErrorBoundary
                            key={clip.name}
                            label={`media-card:${clip.name}`}
                            resetKeys={[clip.name]}
                        >
                            <MediaCard
                                name={clip.name}
                                duration={clip.duration}
                                backgroundUrl={clip.backgroundUrl}
                                columns={columns}
                                selected={
                                    selectionActive
                                        ? selected.has(clip.doc.id)
                                        : undefined
                                }
                                onClick={
                                    onClipSelect || selectionActive
                                        ? e =>
                                              handleClipClick(
                                                  e,
                                                  index,
                                                  clip.doc,
                                              )
                                        : undefined
                                }
                                onPlay={
                                    onClipPlay
                                        ? () => onClipPlay(clip.doc)
                                        : undefined
                                }
                                onDelete={
                                    onClipDelete
                                        ? () => onClipDelete(clip.doc)
                                        : undefined
                                }
                                onRename={
                                    onClipRename
                                        ? () => onClipRename(clip.doc)
                                        : undefined
                                }
                                dragId={
                                    onClipMoveToFolder ? clip.doc.id : undefined
                                }
                            />
                        </SlotErrorBoundary>
                    ))}

                    {showAsDirectories &&
                        folders.map(folder => (
                            <SlotErrorBoundary
                                key={folder}
                                label={`media-folder:${folder}`}
                                resetKeys={[folder]}
                            >
                                <MediaFolder
                                    name={folder}
                                    columns={columns}
                                    onClick={() => onNavigate?.(folder)}
                                    onDelete={
                                        onFolderDelete
                                            ? () => onFolderDelete(folder)
                                            : undefined
                                    }
                                    onRename={
                                        onFolderRename
                                            ? () => onFolderRename(folder)
                                            : undefined
                                    }
                                    onMediaDrop={
                                        onClipMoveToFolder
                                            ? clipId =>
                                                  onClipMoveToFolder(
                                                      clipId,
                                                      `${prefix ?? ''}${folder}`,
                                                  )
                                            : undefined
                                    }
                                />
                            </SlotErrorBoundary>
                        ))}
                </Grid>
            ) : (
                <Stack
                    direction="column"
                    alignItems="center"
                    justifyContent="center"
                    sx={{ py: 6 }}
                    spacing={0.5}
                >
                    <Typography variant="h3" sx={{ color: 'text.secondary' }}>
                        {t('media.empty.title')}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                        {t('media.empty.detail')}
                    </Typography>
                </Stack>
            )}
        </Stack>
    );
};
