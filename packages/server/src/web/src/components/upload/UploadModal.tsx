import React, { useMemo } from 'react';
import {
    Box,
    Button,
    Card,
    LinearProgress,
    Modal,
    Stack,
    Typography,
} from '@mui/material';
import { useTranslation } from 'next-i18next';
import { Injections, UI_INJECTION_ZONE } from '../../lib/api/inject';
import { PhaseIcon } from './PhaseIcon';
import type { FileUploadState } from './types';

interface UploadModalProps {
    state: FileUploadState;
    onClose: () => void;
    onCancel?: () => void;
    onConfirm?: () => void;
    targetPathFor?: (file: File) => string;
    /** Zone to render plugin-injected options in the review phase.
     *  Pass `null` to suppress injected options entirely (e.g. plugin install). */
    optionsZone?: UI_INJECTION_ZONE | null;
}

export const UploadModal: React.FC<UploadModalProps> = ({
    state,
    onClose,
    onCancel,
    onConfirm,
    targetPathFor,
    optionsZone = UI_INJECTION_ZONE.UPLOAD_OPTIONS,
}) => {
    const open = state.phase !== 'idle';
    const handleClose = () => {
        if (state.phase === 'uploading' || state.phase === 'starting')
            onCancel?.();
        onClose();
    };

    return (
        <Modal open={open} onClose={handleClose}>
            <Card
                sx={theme => ({
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
                    optionsZone={optionsZone}
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
    optionsZone?: UI_INJECTION_ZONE | null;
}

const UploadModalContent: React.FC<UploadModalContentProps> = ({
    state,
    onClose,
    onConfirm,
    targetPathFor,
    optionsZone,
}) => {
    const { t } = useTranslation('common');
    const {
        phase,
        queue,
        completed,
        currentIndex,
        currentProgress,
        currentFile,
        error,
    } = state;
    const multi = queue.length > 1;
    const successCount = completed.filter(c => !c.error).length;
    const failedCount = completed.filter(c => c.error).length;

    const targetPaths = useMemo(
        () => (targetPathFor ? queue.map(targetPathFor) : []),
        [queue, targetPathFor],
    );
    const showOptions =
        phase === 'review' && targetPaths.length > 0 && optionsZone != null;

    let title: string;
    if (phase === 'review')
        title = multi
            ? t('media.upload.title.reviewMulti', { count: queue.length })
            : t('media.upload.title.reviewOne');
    else if (phase === 'starting')
        title = multi
            ? t('media.upload.title.preparingMulti', {
                  current: currentIndex + 1,
                  total: queue.length,
              })
            : t('media.upload.title.preparingOne');
    else if (phase === 'uploading')
        title = multi
            ? t('media.upload.title.uploadingMulti', {
                  current: currentIndex + 1,
                  total: queue.length,
              })
            : t('media.upload.title.uploadingOne');
    else if (phase === 'done')
        title = multi
            ? t('media.upload.title.doneMulti', { count: successCount })
            : t('media.upload.title.doneOne');
    else
        title =
            failedCount === queue.length
                ? t('media.upload.title.failed')
                : t('media.upload.title.partial', {
                      success: successCount,
                      total: queue.length,
                  });

    return (
        <Stack spacing={2}>
            <Stack direction="row" alignItems="center" gap={1.5}>
                <PhaseIcon phase={phase} />
                <Typography variant="h3">{title}</Typography>
            </Stack>

            {currentFile && (phase === 'starting' || phase === 'uploading') && (
                <Typography
                    variant="body2"
                    sx={{ color: 'text.secondary', wordBreak: 'break-all' }}
                >
                    {currentFile.name}
                </Typography>
            )}

            {phase === 'review' && (
                <Stack spacing={0.25} sx={{ maxHeight: 160, overflow: 'auto' }}>
                    {queue.map((f, idx) => (
                        <Typography
                            key={`${f.name}-${idx}`}
                            variant="body2"
                            sx={{
                                color: 'text.secondary',
                                wordBreak: 'break-all',
                            }}
                        >
                            {f.name}
                        </Typography>
                    ))}
                </Stack>
            )}

            {phase === 'uploading' && (
                <Stack spacing={0.5}>
                    <LinearProgress
                        variant="determinate"
                        value={currentProgress}
                    />
                    <Typography
                        variant="caption"
                        sx={{ alignSelf: 'flex-end' }}
                    >
                        {currentProgress}%
                    </Typography>
                </Stack>
            )}

            {phase === 'starting' && <LinearProgress />}

            {showOptions && (
                <Box>
                    <Injections zone={optionsZone} props={{ targetPaths }} />
                </Box>
            )}

            {(phase === 'done' || phase === 'error') &&
                multi &&
                completed.length > 0 && (
                    <Stack
                        spacing={0.5}
                        sx={{ maxHeight: 160, overflow: 'auto' }}
                    >
                        {completed
                            .filter(c => c.error)
                            .map((c, idx) => (
                                <Typography
                                    key={`e-${idx}`}
                                    variant="body2"
                                    color="error"
                                    sx={{ wordBreak: 'break-all' }}
                                >
                                    ✗ {c.file.name} — {c.error}
                                </Typography>
                            ))}
                        {completed
                            .filter(c => !c.error)
                            .map((c, idx) => (
                                <Typography
                                    key={`o-${idx}`}
                                    variant="body2"
                                    sx={{
                                        color: 'text.secondary',
                                        wordBreak: 'break-all',
                                    }}
                                >
                                    ✓ {c.file.name}
                                </Typography>
                            ))}
                    </Stack>
                )}

            {phase === 'error' && error && !multi && (
                <Typography
                    variant="body2"
                    color="error"
                    sx={{ wordBreak: 'break-word' }}
                >
                    {error}
                </Typography>
            )}

            <Stack direction="row" justifyContent="flex-end" gap={1}>
                {phase === 'review' ? (
                    <>
                        <Button onClick={onClose} color="inherit">
                            {t('actions.cancel')}
                        </Button>
                        <Button
                            onClick={() => onConfirm?.()}
                            variant="contained"
                            autoFocus
                        >
                            {t('actions.upload')}
                        </Button>
                    </>
                ) : (
                    <Button onClick={onClose} color="inherit">
                        {phase === 'uploading' || phase === 'starting'
                            ? t('actions.cancel')
                            : t('actions.done')}
                    </Button>
                )}
            </Stack>
        </Stack>
    );
};
