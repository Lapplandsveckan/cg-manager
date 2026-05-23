import React, {useRef, useState} from 'react';
import {Box, Stack, Typography, alpha} from '@mui/material';
import {CloudUploadRounded} from '@mui/icons-material';

interface DropzoneProps {
    /** Called with the dropped File list (already filtered + multiple-applied). */
    onDrop: (files: File[]) => void;
    children: React.ReactNode;
    /** Optional accept filter (extensions like `.mp4`, MIME types like `video/*`). */
    accept?: string[];
    /** If false, only the first dropped file is kept. Defaults true. */
    multiple?: boolean;
    /** Skip drag handling entirely (e.g. while a modal is open). */
    disabled?: boolean;
    /** Override the overlay text shown while hovering. */
    overlayLabel?: string;
    /** When true, the zone stretches to at least the parent's full height so
     *  drops anywhere on the page area land — not just on top of the
     *  children. The parent needs an explicit/`flex:1` height. */
    fill?: boolean;
}

function matchesAccept(file: File, accept: string[]): boolean {
    if (!accept.length) return true;
    return accept.some((a) => {
        if (a.startsWith('.')) return file.name.toLowerCase().endsWith(a.toLowerCase());
        if (a.endsWith('/*')) return file.type.startsWith(a.slice(0, -1));
        return file.type === a;
    });
}

/**
 * Generic file-drop target. Renders `children` and shows a copper overlay
 * while a drag-with-files is hovering over the wrapped area. On drop, calls
 * `onDrop` with the (filtered) File list. Pair with `useFileUpload` if you
 * want progress UI; or do whatever else you want with the files.
 *
 * Native HTML5 drag/drop — no react-dnd or dnd-kit needed. Browser drags from
 * the OS file manager fire `dataTransfer.types` containing 'Files', which is
 * what we gate on to avoid lighting up the overlay for unrelated drags
 * (e.g. text selections, plugin rundown-item payloads).
 */
export const Dropzone: React.FC<DropzoneProps> = ({
    onDrop, children, accept = [], multiple = true, disabled, overlayLabel, fill,
}) => {
    const [hovering, setHovering] = useState(false);
    const dragDepth = useRef(0);

    const isFileDrag = (e: React.DragEvent) => e.dataTransfer.types?.includes('Files');

    const onDragEnter = (e: React.DragEvent) => {
        if (disabled || !isFileDrag(e)) return;
        e.preventDefault();
        dragDepth.current += 1;
        setHovering(true);
    };
    const onDragLeave = (e: React.DragEvent) => {
        if (disabled || !isFileDrag(e)) return;
        e.preventDefault();
        // relatedTarget is null when the cursor leaves the browser window —
        // in that case clear immediately instead of waiting for depth to
        // drain (it won't, because subsequent enter events stop firing).
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
        if (accept.length) files = files.filter((f) => matchesAccept(f, accept));
        if (files.length) onDrop(files);
    };

    return (
        <Box
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDragOver={onDragOver}
            onDrop={onDropEvt}
            sx={{position: 'relative', ...(fill && {minHeight: '100%'})}}
        >
            {children}
            {hovering && (
                <Box
                    sx={(theme) => ({
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
                        <CloudUploadRounded sx={{fontSize: 48, color: 'primary.main'}} />
                        <Typography variant="h3" sx={{color: 'primary.main'}}>
                            {overlayLabel ?? 'Drop to upload'}
                        </Typography>
                    </Stack>
                </Box>
            )}
        </Box>
    );
};
