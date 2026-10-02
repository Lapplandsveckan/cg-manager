import React, { useRef, useState } from 'react';
import { Box, Stack, Typography, alpha } from '@mui/material';
import { CloudUploadRounded } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface DropzoneProps {
    onDrop: (files: File[]) => void;
    children: React.ReactNode;
    accept?: string[];
    multiple?: boolean;
    disabled?: boolean;
    overlayLabel?: string;
    fill?: boolean;
}

function matchesAccept(file: File, accept: string[]): boolean {
    if (!accept.length) return true;
    return accept.some(a => {
        if (a.startsWith('.'))
            return file.name.toLowerCase().endsWith(a.toLowerCase());
        if (a.endsWith('/*')) return file.type.startsWith(a.slice(0, -1));
        return file.type === a;
    });
}

export const Dropzone: React.FC<DropzoneProps> = ({
    onDrop,
    children,
    accept = [],
    multiple = true,
    disabled,
    overlayLabel,
    fill,
}) => {
    const { t } = useTranslation('common');
    const [hovering, setHovering] = useState(false);
    const dragDepth = useRef(0);

    const isFileDrag = (e: React.DragEvent) =>
        e.dataTransfer.types?.includes('Files');

    const onDragEnter = (e: React.DragEvent) => {
        if (disabled || !isFileDrag(e)) return;
        e.preventDefault();
        dragDepth.current += 1;
        setHovering(true);
    };
    const onDragLeave = (e: React.DragEvent) => {
        if (disabled || !isFileDrag(e)) return;
        e.preventDefault();
        // relatedTarget is null when leaving the window; enter events stop firing so depth never drains
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
        if (accept.length) files = files.filter(f => matchesAccept(f, accept));
        if (files.length) onDrop(files);
    };

    return (
        <Box
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDragOver={onDragOver}
            onDrop={onDropEvt}
            sx={{ position: 'relative', ...(fill && { minHeight: '100%' }) }}
        >
            {children}
            {hovering && (
                <Box
                    sx={theme => ({
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
                        <CloudUploadRounded
                            sx={{ fontSize: 48, color: 'primary.main' }}
                        />
                        <Typography variant="h3" sx={{ color: 'primary.main' }}>
                            {overlayLabel ?? t('media.dropzone.dropToUpload')}
                        </Typography>
                    </Stack>
                </Box>
            )}
        </Box>
    );
};
