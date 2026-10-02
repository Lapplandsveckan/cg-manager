import React, { useEffect, useRef } from 'react';
import { Dropzone } from './Dropzone';
import { type UploadFileResult, UploadModal, useFileUpload } from './Upload';
import { ManagerApi } from '../lib/api/api';

export interface MediaDropZoneProps {
    destination?: string;
    createUpload?: (file: File) => Promise<string>;
    targetPathFor?: (file: File) => string;
    onComplete?: (results: UploadFileResult[]) => void;
    accept?: string[];
    multiple?: boolean;
    overlayLabel?: string;
    children: React.ReactNode;
}

const DEFAULT_ACCEPT = ['video/*', 'audio/*', 'image/*'];

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

    const onCompleteRef = useRef(onComplete);
    onCompleteRef.current = onComplete;

    const { phase, completed } = ctrl.state;
    useEffect(() => {
        if (phase !== 'done' && phase !== 'error') return;
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
