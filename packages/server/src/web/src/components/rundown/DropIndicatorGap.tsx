import React from 'react';
import { Box } from '@mui/material';

interface DropIndicatorGapProps {
    open: boolean;
    height: number;
}

/** Animated spacer that opens above or below a card to show where a dragged
 *  item will land. */
export const DropIndicatorGap: React.FC<DropIndicatorGapProps> = ({
    open,
    height,
}) => (
    <Box
        sx={{
            height: open ? height : 0,
            flexShrink: 0,
            overflow: 'hidden',
        }}
    />
);
