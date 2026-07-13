export type UploadPhase =
    | 'idle'
    | 'review'
    | 'starting'
    | 'uploading'
    | 'done'
    | 'error';

export interface UploadFileResult {
    file: File;
    error?: string;
}

export interface FileUploadState {
    phase: UploadPhase;
    queue: File[];
    completed: UploadFileResult[];
    currentIndex: number;
    currentProgress: number;
    currentFile: File | null;
    error: string | null;
}

export interface FileUploadController {
    state: FileUploadState;
    start: (files: File[]) => void;
    confirm: () => void;
    cancel: () => void;
    reset: () => void;
}
