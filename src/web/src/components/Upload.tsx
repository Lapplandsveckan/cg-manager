import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Box, Button, Card, LinearProgress, Modal, Stack, Typography, alpha} from '@mui/material';
import {CloudUploadRounded, CheckCircleRounded, ErrorOutlineRounded} from '@mui/icons-material';
import {uploadFile} from '../lib/api/upload';
import {noTryAsync} from 'no-try';
import {pickFiles, PickFilesOptions} from '../lib/filePicker';
import {Injections, UI_INJECTION_ZONE} from '../lib/api/inject';

/** `review` is a "user confirms before chunks go out" phase. It's the
 *  natural place for plugin-driven options (encode-skip, etc.) to take
 *  effect *before* the server starts receiving the file. The operator
 *  picks files → modal opens in `review` → they tick whatever they
 *  want → they confirm → upload proceeds. Cancellation here just
 *  drops back to idle without any server interaction. */
export type UploadPhase = 'idle' | 'review' | 'starting' | 'uploading' | 'done' | 'error';

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
    /** Stage `files` for upload. Transitions the modal to the `review`
     *  phase — the actual chunking happens when `confirm()` is called. */
    start: (files: File[]) => void;
    /** Begin chunking the staged files. Must be called from `review`. */
    confirm: () => void;
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
    // Mirrors `state.queue` for synchronous access from `confirm()`.
    // Without it `confirm` would have to await React state updates
    // to know which files to upload, which complicates the flow.
    const queueRef = useRef<File[]>([]);

    useEffect(() => () => { cancelRef.current?.(); }, []);

    const reset = () => {
        cancelRef.current = null;
        canceledRef.current = false;
        queueRef.current = [];
        setState(IDLE_STATE);
    };

    const cancel = () => {
        canceledRef.current = true;
        cancelRef.current?.();
    };

    const start = (files: File[]) => {
        if (!files.length || runningRef.current) return;
        // Stage the files for review. Plugin-driven options (e.g. the
        // encode plugin's "Skip encoding" checkbox) need a chance to
        // run *before* chunks go out — `confirm()` is what actually
        // kicks off the upload.
        canceledRef.current = false;
        queueRef.current = files;
        setState({
            phase: 'review',
            queue: files,
            completed: [],
            currentIndex: -1,
            currentProgress: 0,
            currentFile: null,
            error: null,
        });
    };

    const confirm = async () => {
        if (runningRef.current) return;
        const files = queueRef.current;
        if (!files.length) return;

        runningRef.current = true;
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

    return {state, start, confirm, cancel, reset};
}

interface UploadModalProps {
    state: FileUploadState;
    onClose: () => void;
    onCancel?: () => void;
    /** Called when the operator confirms the staged upload from the
     *  `review` phase. Pass the controller's `confirm` here. */
    onConfirm?: () => void;
    /** Resolve a `File` to the absolute path it'll land at server-side.
     *  Plugin injections in the UPLOAD_OPTIONS zone receive this as
     *  `props.targetPaths` so they can act on the about-to-be-uploaded
     *  files (e.g. write exemption sidecars). */
    targetPathFor?: (file: File) => string;
}

export const UploadModal: React.FC<UploadModalProps> = ({state, onClose, onCancel, onConfirm, targetPathFor}) => {
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
                <UploadModalContent
                    state={state}
                    onClose={handleClose}
                    onConfirm={onConfirm}
                    targetPathFor={targetPathFor}
                />
            </Card>
        </Modal>
    );
};

interface UploadModalContentProps {
    state: FileUploadState;
    onClose: () => void;
    onConfirm?: () => void;
    targetPathFor?: (file: File) => string;
}

const UploadModalContent: React.FC<UploadModalContentProps> = ({state, onClose, onConfirm, targetPathFor}) => {
    const {phase, queue, completed, currentIndex, currentProgress, currentFile, error} = state;
    const multi = queue.length > 1;
    const successCount = completed.filter((c) => !c.error).length;
    const failedCount = completed.filter((c) => c.error).length;

    // Resolved server-side paths for the files currently in the queue.
    // Passed to plugin injections so they can act per-file (e.g. write
    // an exemption sidecar before the file finishes uploading).
    const targetPaths = useMemo(
        () => (targetPathFor ? queue.map(targetPathFor) : []),
        [queue, targetPathFor],
    );
    // Only show plugin options in the `review` phase — once the user
    // has clicked Upload there's no going back, so toggling sidecars
    // mid-upload would be misleading. The bundle-load race is no
    // longer an issue because the operator must explicitly confirm
    // before any chunks go out, which gives the bundle plenty of time.
    const showOptions = phase === 'review' && targetPaths.length > 0;

    let title: string;
    if (phase === 'review')         title = multi ? `Upload ${queue.length} files?` : 'Upload file?';
    else if (phase === 'starting')  title = multi ? `Preparing ${currentIndex + 1} of ${queue.length}…` : 'Preparing upload…';
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

            {phase === 'review' && (
                // The full list of staged files. For one-file uploads it
                // collapses to a single line — same look as the
                // currentFile preview above during 'uploading'.
                <Stack spacing={0.25} sx={{maxHeight: 160, overflow: 'auto'}}>
                    {queue.map((f, idx) => (
                        <Typography
                            key={`${f.name}-${idx}`}
                            variant="body2"
                            sx={{color: 'text.secondary', wordBreak: 'break-all'}}
                        >
                            {f.name}
                        </Typography>
                    ))}
                </Stack>
            )}

            {phase === 'uploading' && (
                <Stack spacing={0.5}>
                    <LinearProgress variant="determinate" value={currentProgress} />
                    <Typography variant="caption" sx={{alignSelf: 'flex-end'}}>{currentProgress}%</Typography>
                </Stack>
            )}

            {phase === 'starting' && <LinearProgress />}

            {showOptions && (
                // Plugin injections rendered inside the modal while
                // upload is in progress. Toggling a checkbox lands the
                // change before the file finishes writing on the
                // server side, so plugins like `encode` see it before
                // their scanner-driven evaluation runs.
                <Box>
                    <Injections
                        zone={UI_INJECTION_ZONE.UPLOAD_OPTIONS}
                        props={{ targetPaths }}
                    />
                </Box>
            )}

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
                {phase === 'review' ? (
                    <>
                        <Button onClick={onClose} color="inherit">Cancel</Button>
                        <Button
                            onClick={() => onConfirm?.()}
                            variant="contained"
                            autoFocus
                        >
                            Upload
                        </Button>
                    </>
                ) : (
                    <Button onClick={onClose} color="inherit">
                        {phase === 'uploading' || phase === 'starting' ? 'Cancel' : 'Done'}
                    </Button>
                )}
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
    /** Forwarded to UploadModal — only used when this button owns its
     *  own modal (i.e. no `controller` was supplied). */
    targetPathFor?: (file: File) => string;
}

export const UploadButton: React.FC<UploadButtonProps> = ({
    types, createUpload, controller, multiple = true, label = 'Upload', targetPathFor,
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
                <UploadModal
                    state={ctrl.state}
                    onClose={ctrl.reset}
                    onCancel={ctrl.cancel}
                    onConfirm={ctrl.confirm}
                    targetPathFor={targetPathFor}
                />
            )}
        </>
    );
};

export {Dropzone} from './Dropzone';
