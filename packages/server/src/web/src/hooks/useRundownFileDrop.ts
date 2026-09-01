import { useEffect, useRef } from 'react';
import { noTryAsync } from 'no-try';
import { useTranslation } from 'react-i18next';
import { useToast } from '../components/ToastProvider';
import {
    type RundownFileMatchResult,
    type RundownItemDragPayload,
} from '../lib/dragPayload';
import { type ManagerApi } from '../lib/api/api';
import { type UploadFileResult } from '../components/upload/types';
import { useSocket } from '../lib';
import { useLatest } from '../lib/hooks/useLatest';
import { useFileUpload } from './useFileUpload';

async function matchFileAgainstActions(
    conn: ManagerApi,
    file: File,
): Promise<RundownFileMatchResult[]> {
    const [err, matches] = await noTryAsync(() =>
        conn.rundowns.matchActions<RundownFileMatchResult>({
            name: file.name,
            type: file.type,
            size: file.size,
        }),
    );
    return err ? [] : matches;
}

interface FileMatchOutcome {
    matchedFiles: Map<File, RundownFileMatchResult>;
    unmatchedNames: string[];
}

function partitionFileMatches(
    results: { file: File; matches: RundownFileMatchResult[] }[],
): FileMatchOutcome {
    const matchedFiles = new Map<File, RundownFileMatchResult>();
    const unmatchedNames: string[] = [];

    for (const { file, matches } of results) {
        if (!matches.length) {
            unmatchedNames.push(file.name);
            continue;
        }
        // v1: first match only. Multi-match picker is a follow-up.
        matchedFiles.set(file, matches[0]);
    }

    return { matchedFiles, unmatchedNames };
}

// Assigns each successfully-uploaded file the next sequential rundown index
// after `baseIndex`, so a multi-file drop lands in the order it was dropped
// rather than upload-completion order.
function dispatchCompletedUploads(
    completed: UploadFileResult[],
    matchedFiles: Map<File, RundownFileMatchResult>,
    baseIndex: number | undefined,
    onDropItem: UseRundownFileDropOptions['onDropItem'],
): void {
    let offset = 0;
    for (const result of completed) {
        if (result.error) continue;
        const match = matchedFiles.get(result.file);
        if (!match) continue;
        const index =
            baseIndex !== undefined ? baseIndex + offset++ : undefined;
        onDropItem?.(match.payload, index);
    }
}

interface UseRundownFileDropOptions {
    onDropItem?: (payload: RundownItemDragPayload, index?: number) => void;
}

/** Matches dropped files against registered rundown actions, uploads the
 *  matched ones, and calls `onDropItem` once each upload completes. */
export function useRundownFileDrop({ onDropItem }: UseRundownFileDropOptions) {
    const { t } = useTranslation('common');
    const conn = useSocket();
    const notify = useToast();

    // Stash per-file match results across the async match/upload phases.
    // useFileUpload binds createUpload at hook construction, so refs hold state.
    const fileMatchesRef = useRef<Map<File, RundownFileMatchResult>>(new Map());
    const fileBaseIndexRef = useRef<number | undefined>(undefined);
    const onDropItemRef = useRef(onDropItem);
    onDropItemRef.current = onDropItem;

    const uploadCtrl = useFileUpload({
        createUpload: async file => {
            const match = fileMatchesRef.current.get(file);
            if (!match) throw new Error('No match stashed for file');
            return conn.caspar.uploadMedia(match.path, file);
        },
    });

    // useFileUpload returns a fresh controller object every render, so it can't
    // go in the dep array — the effect would refire on every render while the
    // phase stays terminal and re-dispatch the same uploads. Read it through a
    // latest-ref and key the effect on the phase transition alone.
    const uploadCtrlRef = useLatest(uploadCtrl);

    // `completed` is set alongside the terminal phase, so it's current
    // when this effect runs.
    const { phase: uploadPhase } = uploadCtrl.state;
    useEffect(() => {
        if (
            uploadPhase !== 'done' &&
            uploadPhase !== 'error' &&
            uploadPhase !== 'canceled'
        )
            return;

        dispatchCompletedUploads(
            uploadCtrlRef.current.state.completed,
            fileMatchesRef.current,
            fileBaseIndexRef.current,
            onDropItemRef.current,
        );
        fileMatchesRef.current.clear();
        fileBaseIndexRef.current = undefined;
        // Auto-dismiss on success so operator sees items in rundown.
        // Errors stay open for reading failure messages.
        if (uploadPhase === 'done') uploadCtrlRef.current.reset();
    }, [uploadPhase, uploadCtrlRef]);

    const handleFileDrop = async (
        files: File[],
        baseIndex: number | undefined,
    ) => {
        // Run matches in parallel; they don't depend on each other.
        const matchResults = await Promise.all(
            files.map(async file => ({
                file,
                matches: await matchFileAgainstActions(conn, file),
            })),
        );
        const { matchedFiles, unmatchedNames } =
            partitionFileMatches(matchResults);

        if (unmatchedNames.length)
            notify(
                t('rundown.drop.noAction', { count: unmatchedNames.length }),
                'warning',
            );

        if (!matchedFiles.size) return;

        fileMatchesRef.current = matchedFiles;
        fileBaseIndexRef.current = baseIndex;
        uploadCtrl.start(Array.from(matchedFiles.keys()));
        // Auto-confirm after start() to skip the review phase.
        // Explicit drop signals intent without needing confirmation.
        uploadCtrl.confirm();
    };

    return { uploadCtrl, handleFileDrop };
}
