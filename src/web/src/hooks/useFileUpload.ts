import { useEffect, useRef, useState } from 'react';
import { noTryAsync } from 'no-try';
import { useTranslation } from 'next-i18next';
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

    useEffect(
        () => () => {
            cancelRef.current?.();
        },
        [],
    );

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
            setState(s => ({
                ...s,
                phase: 'starting',
                currentIndex: i,
                currentProgress: 0,
                currentFile: file,
                error: null,
            }));

            const [createErr, id] = await noTryAsync(() => createUpload(file));
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

        if (!canceledRef.current) {
            const anyError = completed.some(c => c.error);
            setState({
                phase: anyError ? 'error' : 'done',
                queue: files,
                completed,
                currentIndex: -1,
                currentProgress: 0,
                currentFile: null,
                error: completed.find(c => c.error)?.error ?? null,
            });
        }

        runningRef.current = false;
    };

    return { state, start, confirm, cancel, reset };
}
