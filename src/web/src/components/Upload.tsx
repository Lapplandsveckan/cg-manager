import React, {useEffect, useRef, useState} from 'react';
import {Box, Button, Card, LinearProgress, Modal, Stack, Typography, alpha} from '@mui/material';
import {CloudUploadRounded, CheckCircleRounded, ErrorOutlineRounded} from '@mui/icons-material';
import {uploadFile} from '../lib/api/upload';
import {noTryAsync} from 'no-try';
import {pickFiles, PickFilesOptions} from '../lib/filePicker';

export type UploadPhase = 'idle' | 'starting' | 'uploading' | 'done' | 'error';

export interface UploadFileResult {
    file: File;
    error?: string;
}

export interface FileUploadState {
    phase: UploadPhase;
    queue: File[];
    completed: UploadFileResult[];
    /** 0-based index of the file currently being uploaded; -1 when idle/finished. */
    currentIndex: number;
    /** 0..100. Progress of the current file only. */
    currentProgress: number;
    currentFile: File | null;
    /** Last error message we saw (current file or last failed file). */
    error: string | null;
}

export interface FileUploadController {
    state: FileUploadState;
    start: (files: File[]) => void;
    cancel: () => void;
    reset: () => void;
}

const IDLE_STATE: FileUploadState = {
    phase: 'idle',
    queue: [],
    completed: [],
    currentIndex: -1,
    currentProgress: 0,
    currentFile: null,
    error: null,
};

export interface UseFileUploadOptions {
    createUpload: (file: File) => Promise<string>;
}

/**
 * State machine for one or many sequential uploads. Each file in the queue is
 * fed through `createUpload` (which the caller defines, typically a wrapper
 * around `socket.caspar.uploadMedia(...)`), then streamed via `uploadFile`.
 * Errors on a single file are recorded and the queue continues; cancel
 * aborts the current upload and drops the rest.
 */
export function useFileUpload({createUpload}: UseFileUploadOptions): FileUploadController {
    const [state, setState] = useState<FileUploadState>(IDLE_STATE);
    const cancelRef = useRef<(() => unknown) | null>(null);
    const canceledRef = useRef(false);
    const runningRef = useRef(false);

    useEffect(() => () => { cancelRef.current?.(); }, []);

    const reset = () => {
        cancelRef.current = null;
        canceledRef.current = false;
        setState(IDLE_STATE);
    };

    const cancel = () => {
        canceledRef.current = true;
        cancelRef.current?.();
    };

    const start = async (files: File[]) => {
        if (!files.length || runningRef.current) return;
        runningRef.current = true;
        canceledRef.current = false;

        const completed: UploadFileResult[] = [];

        setState({
            phase: 'starting',
            queue: files,
            completed: [],
            currentIndex: 0,
            currentProgress: 0,
            currentFile: files[0],
            error: null,
        });

        for (let i = 0; i < files.length; i++) {
            if (canceledRef.current) break;

            const file = files[i];
            setState((s) => ({
                ...s,
                phase: 'starting',
                currentIndex: i,
                currentProgress: 0,
                currentFile: file,
                error: null,
            }));

            const [createErr, id] = await noTryAsync(() => createUpload(file));
            if (createErr || !id) {
                const msg = createErr?.message ?? 'Failed to start upload';
                completed.push({file, error: msg});
                setState((s) => ({...s, error: msg}));
                continue;
            }

            setState((s) => ({...s, phase: 'uploading'}));

            const [promise, cancelFn] = uploadFile(
                id,
                file,
                (p) => setState((s) => ({...s, currentProgress: Math.round(p * 100)})),
            );
            cancelRef.current = cancelFn;

            const [uploadErr] = await noTryAsync(() => promise);
            cancelRef.current = null;

            if (canceledRef.current) {
                completed.push({file, error: 'Canceled'});
                break;
            }
            if (uploadErr) {
                completed.push({file, error: uploadErr.message});
                setState((s) => ({...s, error: uploadErr.message}));
                continue;
            }

            completed.push({file});
        }

        // If the consumer canceled, they likely also called reset() to clear
        // the modal — don't clobber that with a 'done'/'error' final state.
        if (!canceledRef.current) {
            const anyError = completed.some((c) => c.error);
            setState({
                phase: anyError ? 'error' : 'done',
                queue: files,
                completed,
                currentIndex: -1,
                currentProgress: 0,
                currentFile: null,
                error: completed.find((c) => c.error)?.error ?? null,
            });
        }

        runningRef.current = false;
    };

    return {state, start, cancel, reset};
}

interface UploadModalProps {
    state: FileUploadState;
    onClose: () => void;
    onCancel?: () => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({state, onClose, onCancel}) => {
    const open = state.phase !== 'idle';
    const handleClose = () => {
        if (state.phase === 'uploading' || state.phase === 'starting') onCancel?.();
        onClose();
    };

    return (
        <Modal open={open} onClose={handleClose}>
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
                <UploadModalContent state={state} onClose={handleClose} />
            </Card>
        </Modal>
    );
};

const UploadModalContent: React.FC<{ state: FileUploadState; onClose: () => void }> = ({state, onClose}) => {
    const {phase, queue, completed, currentIndex, currentProgress, currentFile, error} = state;
    const multi = queue.length > 1;
    const successCount = completed.filter((c) => !c.error).length;
    const failedCount = completed.filter((c) => c.error).length;

    let title: string;
    if (phase === 'starting')      title = multi ? `Preparing ${currentIndex + 1} of ${queue.length}…` : 'Preparing upload…';
    else if (phase === 'uploading') title = multi ? `Uploading ${currentIndex + 1} of ${queue.length}…` : 'Uploading…';
    else if (phase === 'done')      title = multi ? `Uploaded ${successCount} files` : 'Upload complete';
    else                            title = failedCount === queue.length ? 'Upload failed' : `Uploaded ${successCount} of ${queue.length}`;

    return (
        <Stack spacing={2}>
            <Stack direction="row" alignItems="center" gap={1.5}>
                <PhaseIcon phase={phase} />
                <Typography variant="h3">{title}</Typography>
            </Stack>

            {currentFile && (phase === 'starting' || phase === 'uploading') && (
                <Typography variant="body2" sx={{color: 'text.secondary', wordBreak: 'break-all'}}>
                    {currentFile.name}
                </Typography>
            )}

            {phase === 'uploading' && (
                <Stack spacing={0.5}>
                    <LinearProgress variant="determinate" value={currentProgress} />
                    <Typography variant="caption" sx={{alignSelf: 'flex-end'}}>{currentProgress}%</Typography>
                </Stack>
            )}

            {phase === 'starting' && <LinearProgress />}

            {(phase === 'done' || phase === 'error') && multi && completed.length > 0 && (
                // Multi-file summary. Errors first so they don't get buried.
                <Stack spacing={0.5} sx={{maxHeight: 160, overflow: 'auto'}}>
                    {completed.filter((c) => c.error).map((c, idx) => (
                        <Typography key={`e-${idx}`} variant="body2" color="error" sx={{wordBreak: 'break-all'}}>
                            ✗ {c.file.name} — {c.error}
                        </Typography>
                    ))}
                    {completed.filter((c) => !c.error).map((c, idx) => (
                        <Typography key={`o-${idx}`} variant="body2" sx={{color: 'text.secondary', wordBreak: 'break-all'}}>
                            ✓ {c.file.name}
                        </Typography>
                    ))}
                </Stack>
            )}

            {phase === 'error' && error && !multi && (
                <Typography variant="body2" color="error" sx={{wordBreak: 'break-word'}}>
                    {error}
                </Typography>
            )}

            <Stack direction="row" justifyContent="flex-end" gap={1}>
                <Button onClick={onClose} color="inherit">
                    {phase === 'uploading' || phase === 'starting' ? 'Cancel' : 'Done'}
                </Button>
            </Stack>
        </Stack>
    );
};

const PhaseIcon: React.FC<{ phase: UploadPhase }> = ({phase}) => {
    if (phase === 'done') return <CheckCircleRounded sx={{color: '#5fc97a'}} />;
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
            <CloudUploadRounded fontSize="small" sx={{color: 'primary.main'}} />
        </Box>
    );
};

interface UploadButtonProps {
    types: PickFilesOptions['types'];
    /** Creates the server-side upload and returns its id. Receives each picked File. */
    createUpload?: (file: File) => Promise<string>;
    /** Optional external controller — share with a Dropzone on the same page. */
    controller?: FileUploadController;
    /** Allow picking multiple files at once. Defaults true. */
    multiple?: boolean;
    label?: string;
}

export const UploadButton: React.FC<UploadButtonProps> = ({
    types, createUpload, controller, multiple = true, label = 'Upload',
}) => {
    // If an external controller wasn't supplied, create our own. Either way
    // we render an UploadModal — when shared, both the Dropzone and the
    // button feed into the same modal.
    const own = useFileUpload({createUpload: createUpload ?? (() => { throw new Error('createUpload required'); })});
    const ctrl = controller ?? own;

    const handleClick = async () => {
        if (ctrl.state.phase === 'starting' || ctrl.state.phase === 'uploading') return;
        const files = await pickFiles({types, multiple});
        if (files.length) ctrl.start(files);
    };

    return (
        <>
            <Button
                variant="contained"
                startIcon={<CloudUploadRounded />}
                onClick={handleClick}
                disabled={ctrl.state.phase === 'starting' || ctrl.state.phase === 'uploading'}
            >
                {label}
            </Button>

            {/* Only render our own modal when we own the controller. When
                shared, the page owns the modal so we don't double-render. */}
            {!controller && (
                <UploadModal state={ctrl.state} onClose={ctrl.reset} onCancel={ctrl.cancel} />
            )}
        </>
    );
};

interface DropzoneProps {
    /** Called with the dropped File list (already filtered + multiple-applied). */
    onDrop: (files: File[]) => void;
    children: React.ReactNode;
    /** Optional accept filter (extensions like `.mp4`, MIME types like `video/*`). */
    accept?: string[];
    /** If false, only the first dropped file is kept. Defaults true. */
    multiple?: boolean;
    /** Skip drag handling entirely (e.g. while a modal is open). */
    disabled?: boolean;
    /** Override the overlay text shown while hovering. */
    overlayLabel?: string;
}

function matchesAccept(file: File, accept: string[]): boolean {
    if (!accept.length) return true;
    return accept.some((a) => {
        if (a.startsWith('.')) return file.name.toLowerCase().endsWith(a.toLowerCase());
        if (a.endsWith('/*')) return file.type.startsWith(a.slice(0, -1));
        return file.type === a;
    });
}

/**
 * Generic file-drop target. Renders `children` and shows a copper overlay
 * while a drag-with-files is hovering over the wrapped area. On drop, calls
 * `onDrop` with the (filtered) File list. Pair with `useFileUpload` if you
 * want progress UI; or do whatever else you want with the files.
 *
 * Native HTML5 drag/drop — no react-dnd or dnd-kit needed. Browser drags from
 * the OS file manager fire `dataTransfer.types` containing 'Files', which is
 * what we gate on to avoid lighting up the overlay for unrelated drags
 * (e.g. text selections, plugin rundown-item payloads).
 */
export const Dropzone: React.FC<DropzoneProps> = ({
    onDrop, children, accept = [], multiple = true, disabled, overlayLabel,
}) => {
    const [hovering, setHovering] = useState(false);
    const dragDepth = useRef(0);

    const isFileDrag = (e: React.DragEvent) => e.dataTransfer.types?.includes('Files');

    const onDragEnter = (e: React.DragEvent) => {
        if (disabled || !isFileDrag(e)) return;
        e.preventDefault();
        dragDepth.current += 1;
        setHovering(true);
    };
    const onDragLeave = (e: React.DragEvent) => {
        if (disabled || !isFileDrag(e)) return;
        e.preventDefault();
        // relatedTarget is null when the cursor leaves the browser window —
        // in that case clear immediately instead of waiting for depth to
        // drain (it won't, because subsequent enter events stop firing).
        if (e.relatedTarget === null) {
            dragDepth.current = 0;
            setHovering(false);
            return;
        }
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setHovering(false);
    };
    const onDragOver = (e: React.DragEvent) => {
        if (disabled || !isFileDrag(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };
    const onDropEvt = (e: React.DragEvent) => {
        if (disabled || !isFileDrag(e)) return;
        e.preventDefault();
        dragDepth.current = 0;
        setHovering(false);

        let files = Array.from(e.dataTransfer.files);
        if (!multiple) files = files.slice(0, 1);
        if (accept.length) files = files.filter((f) => matchesAccept(f, accept));
        if (files.length) onDrop(files);
    };

    return (
        <Box
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDragOver={onDragOver}
            onDrop={onDropEvt}
            sx={{position: 'relative'}}
        >
            {children}
            {hovering && (
                <Box
                    sx={(theme) => ({
                        position: 'absolute',
                        inset: 0,
                        bgcolor: alpha(theme.palette.primary.main, 0.12),
                        border: `2px dashed ${theme.palette.primary.main}`,
                        borderRadius: 1,
                        pointerEvents: 'none',
                        zIndex: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    })}
                >
                    <Stack alignItems="center" spacing={1}>
                        <CloudUploadRounded sx={{fontSize: 48, color: 'primary.main'}} />
                        <Typography variant="h3" sx={{color: 'primary.main'}}>
                            {overlayLabel ?? 'Drop to upload'}
                        </Typography>
                    </Stack>
                </Box>
            )}
        </Box>
    );
};
