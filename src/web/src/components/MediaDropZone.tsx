import React, { useEffect, useRef } from 'react';
import { Dropzone } from './Dropzone';
import { type UploadFileResult, UploadModal, useFileUpload } from './Upload';
import { ManagerApi } from '../lib/api/api';

export interface MediaDropZoneProps {
    /** Server-side directory prefix that uploaded files will land in.
     *  Use a trailing slash (e.g. `"INTRO/"`); empty string = media root.
     *  Filename comes from the dropped File. Ignored when `createUpload`
     *  is supplied. */
    destination?: string;
    /** Full override over upload-id creation. When supplied, the plugin
     *  owns the path scheme. Pair with `targetPathFor` if you also want
     *  UPLOAD_OPTIONS plugin injections (e.g. encode) to receive
     *  per-file paths during review. */
    createUpload?: (file: File) => Promise<string>;
    /** Resolves each file to its server-side absolute path. Used by the
     *  upload modal to feed UPLOAD_OPTIONS injections. Defaults to
     *  `destination + file.name` unless `createUpload` is supplied. */
    targetPathFor?: (file: File) => string;
    /** Fires once per batch when uploads reach a terminal state (every
     *  file done, or batch errored). Includes errored entries — inspect
     *  `result.error` per file. Use this to act on the newly-uploaded
     *  files (e.g. add a rundown item referencing them). */
    onComplete?: (results: UploadFileResult[]) => void;
    /** Accept globs / extensions. Defaults to media types
     *  (video / audio / image). */
    accept?: string[];
    multiple?: boolean;
    overlayLabel?: string;
    children: React.ReactNode;
}

const DEFAULT_ACCEPT = ['video/*', 'audio/*', 'image/*'];

/**
 * Drag-and-drop file upload for plugin UI (or anywhere else). Wraps
 * `Dropzone` + `useFileUpload` + `UploadModal` so the common "drop here,
 * upload, then do something" flow is a one-liner. For full control, drop
 * down to those primitives directly.
 */
export const MediaDropZone: React.FC<MediaDropZoneProps> = ({
    destination = '',
    createUpload,
    targetPathFor,
    onComplete,
    accept = DEFAULT_ACCEPT,
    multiple = true,
    overlayLabel,
    children,
}) => {
    const defaultPathFor = (file: File) => destination + file.name;
    // When createUpload is custom, the caller owns paths — only feed
    // targetPathFor to the modal if they also gave us one, so plugin
    // injections aren't lied to about where files land.
    const effectiveTargetPathFor =
        targetPathFor ?? (createUpload ? undefined : defaultPathFor);

    const ctrl = useFileUpload({
        createUpload:
            createUpload ??
            (file =>
                ManagerApi.getConnection().caspar.uploadMedia(
                    defaultPathFor(file),
                    file,
                )),
    });

    // Latest onComplete in a ref so the effect's dep list can stay
    // narrow (phase only) — otherwise a new callback identity per render
    // would re-fire the completion handler.
    const onCompleteRef = useRef(onComplete);
    onCompleteRef.current = onComplete;

    const { phase, completed } = ctrl.state;
    useEffect(() => {
        if (phase !== 'done' && phase !== 'error') return;
        // `completed` is set in the same setState as the terminal phase,
        // so it's already the final batch by the time this runs.
        onCompleteRef.current?.(completed);
    }, [phase, completed]);

    const busy = phase === 'starting' || phase === 'uploading';

    return (
        <>
            <Dropzone
                onDrop={ctrl.start}
                accept={accept}
                multiple={multiple}
                disabled={busy}
                overlayLabel={overlayLabel}
            >
                {children}
            </Dropzone>
            <UploadModal
                state={ctrl.state}
                onClose={ctrl.reset}
                onCancel={ctrl.cancel}
                onConfirm={ctrl.confirm}
                targetPathFor={effectiveTargetPathFor}
            />
        </>
    );
};
