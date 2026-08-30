import { useEffect, useRef, useState } from 'react';
import { noTryAsync } from 'no-try';
import { useTranslation } from 'next-i18next/pages';
import { uploadFile } from '../lib/api/upload';
import type {
    FileUploadState,
    FileUploadController,
    UploadFileResult,
} from '../components/upload/types';

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

export function useFileUpload({
    createUpload,
}: UseFileUploadOptions): FileUploadController {
    const { t } = useTranslation('common');
    const [state, setState] = useState<FileUploadState>(IDLE_STATE);
    const cancelRef = useRef<(() => unknown) | null>(null);
    const canceledRef = useRef(false);
    const runningRef = useRef(false);
    const queueRef = useRef<File[]>([]);
    const runIdRef = useRef(0);

    useEffect(
        () => () => {
            cancelRef.current?.();
        },
        [],
    );

    const reset = () => {
        runIdRef.current += 1;
        cancelRef.current = null;
        canceledRef.current = false;
        runningRef.current = false;
        queueRef.current = [];
        setState(IDLE_STATE);
    };

    const cancel = () => {
        canceledRef.current = true;
        cancelRef.current?.();
    };

    const start = (files: File[]) => {
        if (!files.length || runningRef.current) return;
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

        const runId = ++runIdRef.current;
        const stale = () => runIdRef.current !== runId;

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
            if (canceledRef.current || stale()) break;

            const file = files[i];
            setState(s => ({
                ...s,
                phase: 'starting',
                currentIndex: i,
                currentProgress: 0,
                currentFile: file,
                error: null,
            }));

            const [createErr, id] = await noTryAsync(() => createUpload(file));
            if (stale()) break;
            if (createErr || !id) {
                const msg =
                    createErr?.message ?? t('media.upload.errors.startFailed');
                completed.push({ file, error: msg });
                setState(s => ({ ...s, error: msg }));
                continue;
            }

            setState(s => ({ ...s, phase: 'uploading' }));

            const [promise, cancelFn] = uploadFile(id, file, p =>
                setState(s => ({ ...s, currentProgress: Math.round(p * 100) })),
            );
            cancelRef.current = cancelFn;

            const [uploadErr] = await noTryAsync(() => promise);
            cancelRef.current = null;
            if (stale()) break;

            if (canceledRef.current) {
                completed.push({
                    file,
                    error: t('media.upload.errors.canceled'),
                });
                break;
            }
            if (uploadErr) {
                completed.push({ file, error: uploadErr.message });
                setState(s => ({ ...s, error: uploadErr.message }));
                continue;
            }

            completed.push({ file });
        }

        // Always land on a terminal phase, cancel included — files that
        // finished uploading before the cancel are already on disk, and the
        // undo barrier effect (media.tsx) only fires on 'done'/'error'/
        // 'canceled', so a cancel that stayed on 'uploading' forever would
        // leave those files unbarriered and let the next Ctrl+Z reach past
        // them. This is why UploadModal's cancel deliberately doesn't also
        // reset — a reset here makes the run stale and skips this block,
        // since replaying a terminal state would reopen a closed modal.
        if (!stale()) {
            // A deliberate cancel is its own terminal phase, not an error —
            // a cancel caught at the loop-top check (between files) never
            // pushes a per-file error entry, so treating it as 'error' left
            // the modal showing an error state with no message.
            const anyFileError = completed.some(c => c.error);
            const phase = canceledRef.current
                ? 'canceled'
                : anyFileError
                  ? 'error'
                  : 'done';
            setState({
                phase,
                queue: files,
                completed,
                currentIndex: -1,
                currentProgress: 0,
                currentFile: null,
                error: completed.find(c => c.error)?.error ?? null,
            });
            runningRef.current = false;
        }
    };

    return { state, start, confirm, cancel, reset };
}
