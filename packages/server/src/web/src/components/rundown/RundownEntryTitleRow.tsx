import React from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { RundownEntryActions } from './RundownEntryActions';

interface RundownEntryTitleRowProps {
    title: string;
    onPlay: () => void;
    onStop?: () => void;
    onDelete?: () => void;
    disabled?: boolean;
}

/** Title plus the play/stop/delete button cluster. The buttons live in a box
 *  that stops click propagation so pressing one doesn't also trigger the
 *  card's own onClick (edit/play). */
export const RundownEntryTitleRow: React.FC<RundownEntryTitleRowProps> = ({
    title,
    onPlay,
    onStop,
    onDelete,
    disabled,
}) => (
    <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={2}
    >
        <Typography
            variant="h4"
            sx={{ minWidth: 0, flexGrow: 1, wordBreak: 'break-word' }}
        >
            {title}
        </Typography>
        <Box
            draggable={false}
            title=""
            sx={{ flexShrink: 0 }}
            onClick={e => e.stopPropagation()}
        >
            <RundownEntryActions
                onPlay={onPlay}
                onStop={onStop}
                onDelete={onDelete}
                disabled={disabled}
            />
        </Box>
    </Stack>
);
