import React from 'react';
import { Box } from '@mui/material';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';

interface RundownDragHandleProps {
    visible: boolean;
}

/** Grip icon on the left edge of a reorderable card. Always rendered (space
 *  reserved) so toggling edit/live mode doesn't shift the layout — only
 *  `visible` changes. */
export const RundownDragHandle: React.FC<RundownDragHandleProps> = ({
    visible,
}) => (
    <Box
        className="rundown-drag-handle"
        sx={theme => ({
            position: 'absolute',
            left: 2,
            top: 0,
            bottom: 0,
            width: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            visibility: visible ? 'visible' : 'hidden',
            color: theme.palette.text.secondary,
            transition: theme.transitions.create('color', { duration: 120 }),
        })}
    >
        <DragIndicatorRoundedIcon sx={{ fontSize: 16 }} />
    </Box>
);
