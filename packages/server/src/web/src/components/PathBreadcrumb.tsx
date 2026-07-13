import React, { useState } from 'react';
import { Box, Stack, Typography, alpha } from '@mui/material';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import { hasMediaMovePayload, parseMediaMovePayload } from '../lib/dragPayload';

interface CrumbProps {
    label: React.ReactNode;
    onClick: () => void;
    active?: boolean;
    /** When set, the crumb accepts media-move drops. The string is the
     *  full target folder path (no trailing slash, "" for root). */
    dropTarget?: string;
    onMediaDrop?: (clipId: string, folderFullPath: string) => void;
}

const Crumb: React.FC<CrumbProps> = ({
    label,
    onClick,
    active,
    dropTarget,
    onMediaDrop,
}) => {
    const [dropHover, setDropHover] = useState(false);

    const canAccept = dropTarget !== undefined && Boolean(onMediaDrop);
    const isMediaDrag = (e: React.DragEvent) =>
        hasMediaMovePayload(e.dataTransfer);

    return (
        <Box
            component="button"
            onClick={onClick}
            onDragEnter={
                canAccept
                    ? e => {
                          if (!isMediaDrag(e)) return;
                          e.preventDefault();
                          setDropHover(true);
                      }
                    : undefined
            }
            onDragOver={
                canAccept
                    ? e => {
                          if (!isMediaDrag(e)) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          if (!dropHover) setDropHover(true);
                      }
                    : undefined
            }
            onDragLeave={
                canAccept
                    ? e => {
                          if (e.currentTarget.contains(e.relatedTarget as Node))
                              return;
                          setDropHover(false);
                      }
                    : undefined
            }
            onDrop={
                canAccept
                    ? e => {
                          if (!isMediaDrag(e)) return;
                          e.preventDefault();
                          setDropHover(false);
                          const payload = parseMediaMovePayload(e.dataTransfer);
                          if (payload) onMediaDrop?.(payload.id, dropTarget!);
                      }
                    : undefined
            }
            sx={theme => ({
                appearance: 'none',
                background: dropHover
                    ? alpha(theme.palette.primary.main, 0.18)
                    : 'transparent',
                border: dropHover
                    ? `1px solid ${theme.palette.primary.main}`
                    : '1px solid transparent',
                padding: '4px 8px',
                borderRadius: 1,
                cursor: 'pointer',
                color: active
                    ? theme.palette.text.primary
                    : theme.palette.text.secondary,
                fontWeight: active ? 600 : 400,
                fontSize: '0.875rem',
                lineHeight: 1.4,
                display: 'inline-flex',
                alignItems: 'center',
                transition: theme.transitions.create(
                    ['background-color', 'border-color'],
                    {
                        duration: 120,
                    },
                ),
                '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                    color: theme.palette.text.primary,
                },
            })}
        >
            {label}
        </Box>
    );
};

export interface PathBreadcrumbProps {
    path: string;
    onNavigate: (next: string) => void;
    /** When set, each crumb (including Home) accepts media-move drops to
     *  that level of the tree. The active (last) crumb is skipped — drops
     *  there would be a no-op. */
    onMediaDrop?: (clipId: string, folderFullPath: string) => void;
}

export const PathBreadcrumb: React.FC<PathBreadcrumbProps> = ({
    path,
    onNavigate,
    onMediaDrop,
}) => {
    // `path` should always be a string from the page's state but the
    // upstream `router.query.path` can transiently be `undefined` (before
    // hydration) or `string[]` (`?path=a&path=b`); coerce defensively so
    // a stray shape can't crash the page.
    const safePath = typeof path === 'string' ? path : '';
    const segments = safePath.split('/').filter(Boolean);

    // Each crumb represents a level in the tree. The Home crumb's drop
    // target is "" (media root); each segment's is the slash-joined prefix
    // up through that segment (no trailing slash — server's move route
    // appends the filename itself).
    return (
        <Stack direction="row" alignItems="center" gap={0.5} flexWrap="wrap">
            <Crumb
                label={
                    <HomeRoundedIcon
                        fontSize="small"
                        sx={{ display: 'block' }}
                    />
                }
                onClick={() => onNavigate('')}
                dropTarget={onMediaDrop ? '' : undefined}
                onMediaDrop={onMediaDrop}
            />
            {segments.map((segment, index) => {
                const prefix = segments.slice(0, index + 1).join('/');
                const isActive = index === segments.length - 1;
                return (
                    <React.Fragment key={index}>
                        <Typography
                            variant="body2"
                            sx={{ color: 'text.disabled' }}
                        >
                            /
                        </Typography>
                        <Crumb
                            label={segment}
                            onClick={() => onNavigate(`${prefix}/`)}
                            active={isActive}
                            dropTarget={
                                onMediaDrop && !isActive ? prefix : undefined
                            }
                            onMediaDrop={
                                onMediaDrop && !isActive
                                    ? onMediaDrop
                                    : undefined
                            }
                        />
                    </React.Fragment>
                );
            })}
        </Stack>
    );
};
