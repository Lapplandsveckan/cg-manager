import React from 'react';
import { Button } from '@mui/material';
import { CloudUploadRounded } from '@mui/icons-material';
import { useTranslation } from 'next-i18next';
import { pickFiles, type PickFilesOptions } from '../lib/filePicker';
import { UploadModal } from './upload/UploadModal';
import { useFileUpload } from '../hooks/useFileUpload';
import type { FileUploadController } from './upload/types';

export { useFileUpload } from '../hooks/useFileUpload';
export type {
    UploadPhase,
    UploadFileResult,
    FileUploadState,
    FileUploadController,
} from './upload/types';
export { UploadModal } from './upload/UploadModal';

interface UploadButtonProps {
    types: PickFilesOptions['types'];
    createUpload?: (file: File) => Promise<string>;
    controller?: FileUploadController;
    multiple?: boolean;
    label?: string;
    targetPathFor?: (file: File) => string;
}

export const UploadButton: React.FC<UploadButtonProps> = ({
    types,
    createUpload,
    controller,
    multiple = true,
    label,
    targetPathFor,
}) => {
    const { t } = useTranslation('common');
    const own = useFileUpload({
        createUpload:
            createUpload ??
            (() => {
                throw new Error('createUpload required');
            }),
    });
    const ctrl = controller ?? own;

    const handleClick = async () => {
        if (ctrl.state.phase === 'starting' || ctrl.state.phase === 'uploading')
            return;
        const files = await pickFiles({ types, multiple });
        if (files.length) ctrl.start(files);
    };

    return (
        <>
            <Button
                variant="contained"
                startIcon={<CloudUploadRounded />}
                onClick={handleClick}
                disabled={
                    ctrl.state.phase === 'starting' ||
                    ctrl.state.phase === 'uploading'
                }
            >
                {label ?? t('actions.upload')}
            </Button>

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

export { Dropzone } from './Dropzone';
